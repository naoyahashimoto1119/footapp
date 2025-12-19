// DOM取得
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultText = document.getElementById("resultText");
const centerInfo = document.getElementById("centerInfo");

const ctx = canvas.getContext("2d");
let stream = null;

// カメラ開始
startCameraBtn.addEventListener("click", async () => {
  try {
    // 背面カメラを優先（スマホ想定）
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment"
      },
      audio: false
    });

    video.srcObject = stream;

    captureBtn.disabled = false;
    analyzeBtn.disabled = true;

    resultText.textContent = "カメラが起動しました。足を真上から映して、撮影ボタンを押してください。";
    centerInfo.textContent = "";
  } catch (err) {
    console.error(err);
    resultText.textContent = "カメラを起動できませんでした。HTTPS または localhost で開いているか確認してください。";
  }
});

// 撮影
captureBtn.addEventListener("click", () => {
  if (!video.videoWidth || !video.videoHeight) {
    resultText.textContent = "まだカメラ映像が安定していません。少し待ってから再度撮影してください。";
    return;
  }

  // canvas サイズを動画のサイズに合わせる（簡易的に縮小）
  const maxWidth = 480;
  const scale = Math.min(maxWidth / video.videoWidth, 1);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  resultText.textContent = "画像をキャプチャしました。「解析（試作）」ボタンを押してください。";
  analyzeBtn.disabled = false;
});

// 解析（試作）：明るい背景上で足らしき部分の重心を計算してみる
analyzeBtn.addEventListener("click", () => {
  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) {
    resultText.textContent = "まず撮影をしてください。";
    return;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 足（暗めの部分）だけの重心を取るための変数
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  // 足全体のバウンディングボックス（ざっくり）
  let minX = width, maxX = 0, minY = height, maxY = 0;

  // 明るさが一定以下のピクセルを「足側」と仮定（超ざっくり）
  // → 背景が明るめ＆足・靴が少し暗い前提
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // 簡易明度
      const brightness = (r + g + b) / 3;

      // brightness が 230 未満を「足」としてみる
      if (brightness < 230) {
        sumX += x;
        sumY += y;
        count++;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count === 0) {
    resultText.textContent = "足の領域をうまく検出できませんでした。背景を明るめ＆足をはっきり写して再度お試しください。";
    centerInfo.textContent = "";
    return;
  }

  const cx = sumX / count;
  const cy = sumY / count;

  // 重心を目印として描画（赤丸）
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "red";
  ctx.stroke();

  // バウンディングボックスの幅・長さ
  const footWidth = maxX - minX;
  const footLength = maxY - minY;

  // 比率
  const widthToLength = footWidth / footLength;

  // 0〜1 に正規化した重心位置（足の中でどのあたりか）
  const normX = (cx - minX) / (footWidth || 1);   // 左→右
  const normY = (cy - minY) / (footLength || 1);  // 上→下（かかと→つま先、とは限らないが一旦仮）

  // 簡易コメント生成（試作ロジック）
  let widthComment = "標準的な幅";
  if (widthToLength > 0.45) {
    widthComment = "やや幅広ぎみ";
  } else if (widthToLength < 0.35) {
    widthComment = "やや細め";
  }

  let frontBackComment = "足の中央あたりに重心があります";
  if (normY < 0.4) {
    frontBackComment = "かかと寄りに重心がありそうです（やや後重心気味）";
  } else if (normY > 0.6) {
    frontBackComment = "つま先寄りに重心がありそうです（やや前重心気味）";
  }

  let innerOuterComment = "内外バランスはほぼ中央です";
  if (normX < 0.4) {
    innerOuterComment = "やや内側（親指側）に重心が寄っていそうです";
  } else if (normX > 0.6) {
    innerOuterComment = "やや外側（小指側）に重心が寄っていそうです";
  }

  resultText.innerHTML = `
    <p>※ 現在はAIモデルではなく、画像の明るさからざっくり推定する試作版です。</p>
    <ul>
      <li>足の形（縦横比）：${widthComment}</li>
      <li>縦方向の重心：${frontBackComment}</li>
      <li>横方向の重心：${innerOuterComment}</li>
    </ul>
  `;

  centerInfo.innerHTML = `
    <strong>内部計算値（デバッグ用）</strong><br>
    画像サイズ: ${width} × ${height}<br>
    足の幅: ${footWidth.toFixed(1)} px / 足の長さ: ${footLength.toFixed(1)} px<br>
    幅/長さ比: ${widthToLength.toFixed(3)}<br>
    重心座標: (${cx.toFixed(1)}, ${cy.toFixed(1)})<br>
    足内での重心位置(横): ${(normX * 100).toFixed(1)}%（左→右）<br>
    足内での重心位置(縦): ${(normY * 100).toFixed(1)}%（上→下）
  `;
});
