# backend/train.py
import torch
import torch.nn as nn
import torch.optim as optim
from pathlib import Path

from dataset import create_dataloaders
from model import FootShapeNet, MODEL_PATH

EPOCHS = 10
BATCH_SIZE = 16
LR = 1e-4


def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] device: {device}")

    train_loader, val_loader, class_names = create_dataloaders(
        data_dir="../dataset/images",
        batch_size=BATCH_SIZE,
        val_ratio=0.2,
    )

    model = FootShapeNet(num_classes=len(class_names)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)

    for epoch in range(1, EPOCHS + 1):
        # === Train ===
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        train_loss = running_loss / total
        train_acc = correct / total

        # === Validation ===
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        val_loss /= val_total
        val_acc = val_correct / val_total

        print(
            f"Epoch [{epoch}/{EPOCHS}] "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc:.3f} "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc:.3f}"
        )

    # モデル保存
    save_path = Path(MODEL_PATH)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), save_path)
    print(f"[INFO] モデルを保存しました: {save_path}")


if __name__ == "__main__":
    train()
