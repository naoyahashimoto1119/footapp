# backend/api.py
from io import BytesIO

import numpy as np
from PIL import Image

import torch
from torchvision import transforms

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from model import load_model, CLASS_NAMES

# FastAPI アプリ作成
app = FastAPI(title="Foot Analysis API")

# CORS（フロントエンドからアクセスできるように）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番はドメインを絞った方が安全
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = load_model(device)

# 画像の前処理（学習時と合わせる）
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    足の画像を受け取り、つま先のタイプを推論して返すエンドポイント
    """
    # ファイルをバイト列として読み込み
    contents = await file.read()
    image = Image.open(BytesIO(contents)).convert("RGB")

    # 前処理
    img_tensor = transform(image).unsqueeze(0).to(device)

    # 推論
    with torch.no_grad():
        outputs = model(img_tensor)
        probs = torch.softmax(outputs, dim=1)[0].cpu().numpy()

    pred_idx = int(np.argmax(probs))
    label = CLASS_NAMES[pred_idx]

    descriptions = {
        CLASS_NAMES[0]: "親指が一番長いタイプです。一般的に日本人に多い足型と言われています。",
        CLASS_NAMES[1]: "人差し指が一番長いタイプです。フィット感やつま先の余りに注意すると良いです。",
        CLASS_NAMES[2]: "つま先の長さがそろっているタイプです。つま先がまっすぐなシューズと相性が良いと言われます。",
    }

    result = {
        "label": label,
        "description": descriptions.get(label, ""),
        "probabilities": {
            CLASS_NAMES[i]: float(probs[i]) for i in range(len(CLASS_NAMES))
        },
    }

    return result
