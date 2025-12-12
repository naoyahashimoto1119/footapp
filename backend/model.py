# backend/model.py
import torch
import torch.nn as nn
from pathlib import Path

# 分類したいクラス名（例：つま先の形）
CLASS_NAMES = [
    "エジプト型（親指が一番長い）",
    "ギリシャ型（人差し指が一番長い）",
    "スクエア型（つま先が一直線）",
]

MODEL_PATH = Path(__file__).parent / "model.pth"


class FootShapeNet(nn.Module):
    """シンプルなCNN。入力: 3x224x224 の足画像"""

    def __init__(self, num_classes: int = len(CLASS_NAMES)):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),   # 112x112

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),   # 56x56

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),   # 28x28

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),   # 14x14
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 14 * 14, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


def load_model(device: torch.device) -> FootShapeNet:
    """学習済みモデルを読み込み（なければランダム初期化のまま）"""
    model = FootShapeNet(num_classes=len(CLASS_NAMES))

    if MODEL_PATH.exists():
        state = torch.load(MODEL_PATH, map_location=device)
        model.load_state_dict(state)
        print(f"[INFO] モデルを読み込みました: {MODEL_PATH}")
    else:
        print("[WARN] model.pth が見つかりません。ランダム初期化モデルを使用します。")

    model.to(device)
    model.eval()
    return model
