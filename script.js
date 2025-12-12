// ====== グローバル変数 ======
let canvas, ctx;
let img = new Image();

// ポイント定義
const POINT_LABELS = [
  { key: 'heel', label: 'かかと', color: '#FF6B6B' },
  { key: 'bigToe', label: '親指の先', color: '#4ECDC4' },
  { key: 'secondToe', label: '人差し指の先', color: '#45B7D1' },
  { key: 'littleToe', label: '小指の先', color: '#96CEB4' },
  { key: 'widthLeft', label: '足幅 左端', color: '#FFEAA7' },
  { key: 'widthRight', label: '足幅 右端', color: '#DDA0DD' },
];

let points = [];

// ====== 起動時処理 ======
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('footCanvas');
  ctx = canvas.getContext('2d');

  document.getElementById('imageInput').addEventListener('change', handleImageUpload);
  document.getElementById('retryBtn').addEventListener('click', () => {
    document.getElementById('imageInput').click();
  });
});

// ====== 画像アップロード → 自動分析 ======
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const imageBase64 = dataUrl.split(',')[1];
    
    img.onload = () => {
      // UI表示
      document.getElementById('resultSection').style.display = 'block';
      document.getElementById('analyzing').style.display = 'flex';
      document.getElementById('result').innerHTML = '';
      document.getElementById('retryBtn').style.display = 'none';
      document.getElementById('errorMessage').style.display = 'none';
      
      // キャンバス描画
      resizeCanvasToImage();
      drawImage();
      
      // 自動でAI分析開始
      analyzeWithAI(imageBase64);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
  
  // 同じファイルを再選択できるようにリセット
  event.target.value = '';
}

// キャンバスサイズを画像に合わせる
function resizeCanvasToImage() {
  const maxWidth = 600;
  const containerWidth = canvas.parentElement.clientWidth;
  const baseWidth = Math.min(img.width, maxWidth, containerWidth);

  const scale = baseWidth / img.width;
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
}

// 画像とポイントを描画
function drawImage() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // ポイント描画
  points.forEach((p, index) => {
    const info = POINT_LABELS[index];
    drawPoint(p.x, p.y, info.color, index + 1, info.label);
  });
}

// ポイントを描画
function drawPoint(x, y, color, index, label) {
  // 円
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.closePath();

  // 番号
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(index.toString(), x, y);

  // ラベル
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 14, y - 6);
}

// ====== AI自動分析 ======
async function analyzeWithAI(imageBase64) {
  const errorDiv = document.getElementById('errorMessage');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `この足の画像を分析してください。以下の6つのポイントの位置を、画像の左上を(0,0)、右下を(100,100)としたパーセンテージ座標で推定してください。

1. heel (かかとの中心点)
2. bigToe (親指の先端)
3. secondToe (人差し指の先端)
4. littleToe (小指の先端)
5. widthLeft (足幅が最も広い部分の左端)
6. widthRight (足幅が最も広い部分の右端)

必ず以下のJSON形式のみで回答してください。他のテキストは含めないでください：
{"heel":{"x":数値,"y":数値},"bigToe":{"x":数値,"y":数値},"secondToe":{"x":数値,"y":数値},"littleToe":{"x":数値,"y":数値},"widthLeft":{"x":数値,"y":数値},"widthRight":{"x":数値,"y":数値}}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API エラーが発生しました');
    }
    
    const text = data.content?.[0]?.text || '';
    
    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AIからの応答を解析できませんでした');
    }

    const detected = JSON.parse(jsonMatch[0]);
    
    // パーセンテージをピクセル座標に変換
    points = POINT_LABELS.map(({ key }) => ({
      x: (detected[key].x / 100) * canvas.width,
      y: (detected[key].y / 100) * canvas.height,
      key,
    }));

    drawImage();
    document.getElementById('analyzing').style.display = 'none';
    document.getElementById('retryBtn').style.display = 'block';
    calculateResult();
    
  } catch (err) {
    console.error(err);
    document.getElementById('analyzing').style.display = 'none';
    errorDiv.textContent = 'AI分析に失敗しました。別の写真で試してください。';
    errorDiv.style.display = 'block';
    document.getElementById('retryBtn').style.display = 'block';
  }
}

// ====== 診断ロジック ======
function calculateResult() {
  if (points.length < POINT_LABELS.length) return;

  const getPoint = (key) => points.find(p => p.key === key);
  const heel = getPoint('heel');
  const bigToe = getPoint('bigToe');
  const secondToe = getPoint('secondToe');
  const littleToe = getPoint('littleToe');
  const widthLeft = getPoint('widthLeft');
  const widthRight = getPoint('widthRight');

  const distance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

  const dHeelBig = distance(heel, bigToe);
  const dHeelSecond = distance(heel, secondToe);
  const dHeelLittle = distance(heel, littleToe);
  const width = distance(widthLeft, widthRight);
  const widthRatio = width / dHeelBig;

  // 足幅タイプ判定
  let widthType, widthClass;
  if (widthRatio < 0.36) {
    widthType = '細め';
    widthClass = 'narrow';
  } else if (widthRatio > 0.40) {
    widthType = '幅広';
    widthClass = 'wide';
  } else {
    widthType = 'ふつう';
    widthClass = 'normal';
  }

  // つま先タイプ判定
  const diff = dHeelBig - dHeelSecond;
  let toeType, toeClass;
  if (diff > 5) {
    toeType = 'エジプト型';
    toeClass = 'egypt';
  } else if (diff < -5) {
    toeType = 'ギリシャ型';
    toeClass = 'greek';
  } else {
    toeType = 'スクエア型';
    toeClass = 'square';
  }

  // コメント
  const widthComments = {
    narrow: '細身のスパイクや甲が高くないモデルがフィットしやすいです',
    normal: '多くのメーカーのレギュラーフィットに合いやすいタイプです',
    wide: 'ワイドモデルや足幅にゆとりのあるスパイクがおすすめです',
  };

  const toeComments = {
    egypt: '親指側が長いので、つま先に余裕があるモデルを選びましょう',
    greek: '人差し指が長めなので、つま先全体に均等な余裕がある形が◎',
    square: '指の長さが揃っているので、トウボックスが広めのモデルと相性良し',
  };

  // 結果表示
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <div class="result-card">
      <div class="result-item">
        <span class="result-label">足幅タイプ</span>
        <span class="result-tag tag-${widthClass}">${widthType}</span>
      </div>
      <p class="comment">${widthComments[widthClass]}</p>
    </div>

    <div class="result-card">
      <div class="result-item">
        <span class="result-label">つま先の形</span>
        <span class="result-tag tag-${toeClass}">${toeType}</span>
      </div>
      <p class="comment">${toeComments[toeClass]}</p>
    </div>

    <div class="data-table">
      <h3 class="data-title">計測データ</h3>
      <div class="data-row">
        <span>幅／長さ比率</span>
        <span class="data-value">${widthRatio.toFixed(3)}</span>
      </div>
      <div class="data-row">
        <span>かかと〜親指</span>
        <span class="data-value">${dHeelBig.toFixed(1)} px</span>
      </div>
      <div class="data-row">
        <span>かかと〜人差し指</span>
        <span class="data-value">${dHeelSecond.toFixed(1)} px</span>
      </div>
      <div class="data-row">
        <span>かかと〜小指</span>
        <span class="data-value">${dHeelLittle.toFixed(1)} px</span>
      </div>
      <div class="data-row">
        <span>足幅</span>
        <span class="data-value">${width.toFixed(1)} px</span>
      </div>
    </div>

    <p class="disclaimer">
      ※ この診断は写真に基づく簡易的な推定です。<br>
      実際のサイズ選びでは試し履きも合わせてご確認ください。
    </p>
  `;
}