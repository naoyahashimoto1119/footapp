# backend/dataset.py
from pathlib import Path
from typing import Tuple, List

import torch
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms


def create_dataloaders(
    data_dir: str = "../dataset/images",
    batch_size: int = 16,
    val_ratio: float = 0.2,
) -> Tuple[DataLoader, DataLoader, List[str]]:
    """
    dataset/images/クラス名/画像.jpg という構造を想定。
    ImageFolderを使って train/val の DataLoader を作成する。
    """

    data_path = Path(__file__).parent / data_dir

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        # 一般的なImageNetの正規化（とりあえず定番を使用）
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    dataset = datasets.ImageFolder(root=str(data_path), transform=transform)
    class_names = dataset.classes

    # train / val に分割
    val_size = int(len(dataset) * val_ratio)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False, num_workers=0
    )

    return train_loader, val_loader, class_names
