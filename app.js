const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const retakeBtn = document.getElementById("retakeBtn");
const resultText = document.getElementById("resultText");
const centerInfo = document.getElementById("centerInfo");

const ctx = canvas.getContext("2d");
let stream = null;

// 表示モード切り替え
function showCameraView() {
  video.classList.remove("hidden");
  canvas.classList.add("hidden");
}

function showCapturedView() {
  video.classList.add("hidden");
  canvas.classList.remove("hidden");
}

// ボタン状態の初期化
function resetUI() {
  startCameraBtn.disabled = false;
  captureBtn.disabled = true;
  analyzeBtn.disabled = true;
  retakeBtn.disabled = true;
  startCameraBtn.textContent = "カメラ開始";
  resultText.textContent = "まだ解析していません。足を撮影して「解析」ボタンを押してください。（つま先が上になるように撮影）";
  centerInfo.textContent = "";
  showCameraView();
}

// カメラ停止
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
}

// 初期状態
resetUI();

/* =========================
   足解析ロジック（Bパート）
   ========================= */

/**
 * 画像データから足マスク＆重心などの統計量を計算
 * - 明るさの平均から自動で閾値を決めて足っぽい領域を抽出
 */
function computeFootMaskStats(imageData, width, height) {
  const data = imageData.data;
  const totalPixels = width * height;

  // 1回目ループ：平均明度を求める
  let sumBrightness = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = (r + g + b) / 3;
    sumBrightness += brightness;
  }
  const meanBrightness = sumBrightness / totalPixels;

  // 背景が明るく、足が少し暗い前提で閾値を設定（平均の 0.9 倍）
  const threshold = meanBrightness * 0.9;

  // 2回目ループ：足マスク＆重心・バウンディングボックスを計算
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  let minX = width, maxX = 0, minY = height, maxY = 0;

  const mask = new Uint8Array(totalPixels); // 1=足,0=背景

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < threshold) {
        mask[y * width + x] = 1;
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
    return null; // 足検出失敗
  }

  const cx = sumX / count;
  const cy = sumY / count;

  const footWidth = maxX - minX;
  const footLength = maxY - minY;

  return {
    mask,
    count,
    cx,
    cy,
    minX,
    maxX,
    minY,
    maxY,
    footWidth,
    footLength,
    meanBrightness,
    threshold
  };
}

/**
 * 幅/長さ比から足の幅タイプを分類
 */
function classifyWidth(footWidth, footLength) {
  const ratio = footWidth / footLength;

  let label = "標準的な幅";
  let detail = `幅/長さ比 = ${ratio.toFixed(3)}`;

  if (ratio > 0.47) {
    label = "かなり幅広め";
  } else if (ratio > 0.42) {
    label = "やや幅広め";
  } else if (ratio < 0.33) {
    label = "かなり細め";
  } else if (ratio < 0.37) {
    label = "やや細め";
  }

  return { label, ratio, detail };
}

/**
 * 重心の位置（縦・横）からコメントを生成
 */
function classifyCenter(normX, normY) {
  let frontBackComment = "足の中央あたりに重心があります";
  if (normY < 0.4) {
    frontBackComment = "かかと寄りに重心がありそうです（やや後重心気味）";
  } else if (normY > 0.6) {
    frontBackComment = "つま先寄りに重心がありそうです（やや前重心気味）";
  }

  let innerOuterComment = "内外のバランスはほぼ中央です";
  if (normX < 0.4) {
    innerOuterComment = "やや内側（親指側）に重心が寄っていそうです";
  } else if (normX > 0.6) {
    innerOuterComment = "やや外側（小指側）に重心が寄っていそうです";
  }

  return { frontBackComment, innerOuterComment };
}

/**
 * つま先の形（エジプト / ギリシャ / スクエア）をざっくり推定
 * - 前提：つま先が画像の「上側」に来るように撮影している
 * - 足の領域を左右3分割して、一番先に出ている部分を調べる
 */
function estimateToeShape(mask, width, height, minX, maxX, minY, maxY) {
  const footWidth = maxX - minX;
  const footLength = maxY - minY;

  if (footWidth <= 0 || footLength <= 0) {
    return { type: "判定不能", detail: "足領域が小さすぎるため形状判定不可" };
  }

  const slices = 3; // 左(親指側)・中央・右(小指側) に分割
  const sliceAdvance = [];

  for (let s = 0; s < slices; s++) {
    const startX = Math.floor(minX + (footWidth * s) / slices);
    const endX = Math.floor(minX + (footWidth * (s + 1)) / slices);

    let found = false;
    let minToeY = maxY + 1; // できるだけ小さい値を探す（上側）

    for (let x = startX; x < endX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (mask[y * width + x] === 1) {
          if (y < minToeY) {
            minToeY = y;
            found = true;
          }
          break; // この列で一番上の足ピクセルは見つかったので次のxへ
        }
      }
    }

    if (found) {
      const advance = (minToeY - minY) / footLength; // 0〜1、小さいほど先端側
      sliceAdvance.push(advance);
    } else {
      sliceAdvance.push(1.0); // 足がない領域扱い
    }
  }

  // 一番先に出ているスライスを探す（値が一番小さい）
  const minAdvance = Math.min(...sliceAdvance);
  const minIndex = sliceAdvance.indexOf(minAdvance);

  // 差が小さいとスクエア扱い
  const sorted = [...sliceAdvance].sort((a, b) => a - b);
  const diff = sorted[1] - sorted[0];

  let type = "判定不能";
  if (diff < 0.03) {
    type = "スクエア型（指の長さが近い）っぽい";
  } else if (minIndex === 0) {
    type = "エジプト型（親指が一番長い）っぽい";
  } else if (minIndex === 1) {
    type = "ギリシャ型（人差し指あたりが一番長い）っぽい";
  } else if (minIndex === 2) {
    type = "外側寄りのつま先形状っぽい";
  }

  const detail = `スライスごとの先端度合い: 左=${sliceAdvance[0].toFixed(3)}, 中央=${sliceAdvance[1].toFixed(3)}, 右=${sliceAdvance[2].toFixed(3)}（小さいほど先端側）`;

  return { type, detail };
}

/**
 * canvas 上の画像から足の特徴をまとめて解析
 */
function analyzeFootFromCanvas(debugDraw = true) {
  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) {
    return { error: "まず撮影をしてください。" };
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const stats = computeFootMaskStats(imageData, width, height);

  if (!stats) {
    return { error: "足の領域をうまく検出できませんでした。背景を明るめ＆足をはっきり写して再度お試しください。" };
  }

  const {
    mask,
    cx,
    cy,
    minX,
    maxX,
    minY,
    maxY,
    footWidth,
    footLength,
    meanBrightness,
    threshold
  } = stats;

  // デバッグ描画：バウンディングボックス & 重心
  if (debugDraw) {
    // 元画像を一度描き直す
    ctx.putImageData(imageData, 0, 0);

    // バウンディングボックス
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, footWidth, footLength);

    // 重心
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "red";
    ctx.stroke();
  }

  const widthInfo = classifyWidth(footWidth, footLength);

  const normX = (cx - minX) / (footWidth || 1);
  const normY = (cy - minY) / (footLength || 1);

  const centerInfoText = classifyCenter(normX, normY);

  const toeInfo = estimateToeShape(mask, width, height, minX, maxX, minY, maxY);

  return {
    error: null,
    widthInfo,
    centerInfoText,
    toeInfo,
    debug: {
      width,
      height,
      footWidth,
      footLength,
      cx,
      cy,
      normX,
      normY,
      meanBrightness,
      threshold
    }
  };
}

/* =========================
   ここまで解析ロジック
   ========================= */

// カメラ開始
startCameraBtn.addEventListener("click", async () => {
  try {
    stopCamera(); // 念のため一旦止める
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = stream;
    showCameraView(); // カメラモード

    startCameraBtn.disabled = true;
    captureBtn.disabled = false;
    analyzeBtn.disabled = true;
    retakeBtn.disabled = true;

    resultText.textContent = "カメラが起動しました。足を真上から映して、撮影ボタンを押してください。（つま先が上になる向きで）";
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

  const maxWidth = 480;
  const scale = Math.min(maxWidth / video.videoWidth, 1);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 撮影後はカメラを隠して写真のみ表示
  stopCamera();
  showCapturedView();

  startCameraBtn.disabled = false;
  startCameraBtn.textContent = "カメラ再開";
  captureBtn.disabled = true;
  analyzeBtn.disabled = false;
  retakeBtn.disabled = false;

  resultText.textContent = "画像をキャプチャしました。「解析」ボタンを押してください。";
});

// 解析ボタン
analyzeBtn.addEventListener("click", () => {
  const res = analyzeFootFromCanvas(true);

  if (res.error) {
    resultText.textContent = res.error;
    centerInfo.textContent = "";
    return;
  }

  const { widthInfo, centerInfoText, toeInfo, debug } = res;

  resultText.innerHTML = `
    <p>※ 現在はAIモデルではなく、画像処理だけで推定する試作版です。</p>
    <ul>
      <li>足の形（縦横比）：${widthInfo.label}</li>
      <li>つま先の形：${toeInfo.type}</li>
      <li>縦方向の重心：${centerInfoText.frontBackComment}</li>
      <li>横方向の重心：${centerInfoText.innerOuterComment}</li>
    </ul>
    <p style="font-size:0.8rem; color:#777;">
      ※ つま先が上方向になるように撮影すると精度が上がります。
    </p>
  `;

  centerInfo.innerHTML = `
    <strong>内部計算値（デバッグ用）</strong><br>
    画像サイズ: ${debug.width} × ${debug.height}<br>
    足の幅: ${debug.footWidth.toFixed(1)} px / 足の長さ: ${debug.footLength.toFixed(1)} px<br>
    幅/長さ比: ${widthInfo.ratio.toFixed(3)}<br>
    重心座標: (${debug.cx.toFixed(1)}, ${debug.cy.toFixed(1)})<br>
    足内での重心位置(横): ${(debug.normX * 100).toFixed(1)}%（左→右）<br>
    足内での重心位置(縦): ${(debug.normY * 100).toFixed(1)}%（上→下）<br>
    平均明度: ${debug.meanBrightness.toFixed(1)} / 閾値: ${debug.threshold.toFixed(1)}<br>
    【つま先形状デバッグ】${toeInfo.detail}
  `;
});

// もう一度撮る
retakeBtn.addEventListener("click", () => {
  centerInfo.textContent = "";
  resultText.textContent = "カメラを再起動します。足を真上から映して、撮影ボタンを押してください。（つま先が上になる向きで）";
  startCameraBtn.click(); // カメラ開始ボタンを擬似的に押す
});
