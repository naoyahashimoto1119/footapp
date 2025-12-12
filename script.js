// ====== グローバル変数 ======

// キャンバス関連
let canvas, ctx;
let img = new Image();
let imgLoaded = false;

// クリックで指定するポイント（順番）
const POINT_LABELS = [
  "かかと",
  "親指の先",
  "人差し指の先",
  "小指の先",
  "足幅 左端",
  "足幅 右端"
];

let points = []; // {x, y, label}

// ====== 起動時処理 ======
window.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("footCanvas");
  ctx = canvas.getContext("2d");

  const imageInput = document.getElementById("imageInput");
  imageInput.addEventListener("change", handleImageUpload);

  // スマホのタップも click イベントとして飛んでくるのでこれでOK
  canvas.addEventListener("click", handleCanvasClick);

  updateInstruction("まずは写真を撮る / 選ぶ から始めてください。");
});

// ====== 画像アップロード処理 ======
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    img.onload = () => {
      imgLoaded = true;
      points = []; // リセット
      resizeCanvasToImage();
      drawImage();
      updateInstruction(`画像を読み込みました。「${POINT_LABELS[0]}」の位置をタップしてください。`);
      updateResultInitial();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// キャンバスサイズを画像サイズに合わせる（横幅は画面にフィット）
function resizeCanvasToImage() {
  const maxWidth = 800;          // PCで見たときの上限
  const containerWidth = canvas.parentElement.clientWidth;
  const baseWidth = Math.min(img.width, maxWidth, containerWidth);

  const scale = baseWidth / img.width;
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
}

// 画像をキャンバスに描画
function drawImage() {
  if (!imgLoaded) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // すでに指定済みのポイントがあれば再描画
  points.forEach((p, index) => {
    drawPoint(p.x, p.y, p.label, index + 1);
  });
}

// ====== キャンバスクリック処理 ======
function handleCanvasClick(event) {
  if (!imgLoaded) return;
  if (points.length >= POINT_LABELS.length) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const label = POINT_LABELS[points.length];
  points.push({ x, y, label });

  drawImage(); // 画像＋既存ポイント再描画
  drawPoint(x, y, label, points.length);

  if (points.length < POINT_LABELS.length) {
    const nextLabel = POINT_LABELS[points.length];
    updateInstruction(`「${label}」を記録しました。次は「${nextLabel}」の位置をタップしてください。`);
  } else {
    updateInstruction("すべてのポイントを指定しました。診断結果を計算しています…");
    analyzeFoot();
  }
}

// ポイントを描画（小さな丸＋番号＋ラベル）
function drawPoint(x, y, label, index) {
  const radius = 5;

  // 丸
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ff5722";
  ctx.fill();
  ctx.closePath();

  // 番号とラベル
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#000000";
  ctx.fillText(index.toString(), x + 8, y - 4);
  ctx.fillText(label, x + 8, y + 10);
}

// ====== 診断ロジック ======
function analyzeFoot() {
  if (points.length < POINT_LABELS.length) return;

  const heel = points[0];
  const bigToe = points[1];
  const secondToe = points[2];
  const littleToe = points[3];
  const widthLeft = points[4];
  const widthRight = points[5];

  const dHeelBig = distance(heel, bigToe);
  const dHeelSecond = distance(heel, secondToe);
  const dHeelLittle = distance(heel, littleToe);
  const width = distance(widthLeft, widthRight);

  const widthRatio = width / dHeelBig;

  let widthType = "ふつう";
  let widthTagClass = "tag-normal";
  if (widthRatio < 0.36) {
    widthType = "細め";
    widthTagClass = "tag-narrow";
  } else if (widthRatio > 0.40) {
    widthType = "幅広";
    widthTagClass = "tag-wide";
  }

  const diff = dHeelBig - dHeelSecond;
  const toeThreshold = 5;
  let toeType = "スクエア型（ほぼ同じ長さ）";
  let toeTagClass = "tag-square";

  if (diff > toeThreshold) {
    toeType = "エジプト型（親指が一番長い）";
    toeTagClass = "tag-egypt";
  } else if (diff < -toeThreshold) {
    toeType = "ギリシャ型（人差し指が一番長い）";
    toeTagClass = "tag-greek";
  }

  let widthComment = "";
  if (widthType === "細め") {
    widthComment = "足幅が比較的細めなので、細身のスパイクや、甲が高くないモデルの方がフィットしやすいかもしれません。";
  } else if (widthType === "ふつう") {
    widthComment = "足幅は標準的なバランスで、多くのメーカーのレギュラーフィットに合いやすいタイプです。";
  } else {
    widthComment = "幅広タイプなので、ワイドモデルや、足幅にゆとりのあるスパイクを選ぶと楽だと思います。";
  }

  let toeComment = "";
  if (toeType.startsWith("エジプト型")) {
    toeComment = "親指側が長いので、つま先側に少し余裕があるモデルを選ばないと親指だけ当たりやすくなります。";
  } else if (toeType.startsWith("ギリシャ型")) {
    toeComment = "人差し指が長めなので、つま先全体に均等に余裕がある形のスパイクが合いやすいです。";
  } else {
    toeComment = "指の長さがそろっていて、つま先の形が四角っぽいタイプです。トウボックスが広めのモデルと相性が良いです。";
  }

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <p><strong>診断まとめ（簡易）</strong></p>
    <table class="result-table">
      <tr>
        <th>項目</th>
        <th>値（ピクセル）</th>
        <th>説明</th>
      </tr>
      <tr>
        <td>かかと〜親指の長さ</td>
        <td>${dHeelBig.toFixed(1)} px</td>
        <td>足の「長さ」の基準として使用</td>
      </tr>
      <tr>
        <td>かかと〜人差し指の長さ</td>
        <td>${dHeelSecond.toFixed(1)} px</td>
        <td>指の形（エジプト／ギリシャ）の判定に使用</td>
      </tr>
      <tr>
        <td>かかと〜小指の長さ</td>
        <td>${dHeelLittle.toFixed(1)} px</td>
        <td>左右バランスのざっくりチェック用</td>
      </tr>
      <tr>
        <td>足幅（いちばん広い部分）</td>
        <td>${width.toFixed(1)} px</td>
        <td>幅広・細めの判定に使用</td>
      </tr>
      <tr>
        <td>幅／長さの比率</td>
        <td>${widthRatio.toFixed(3)}</td>
        <td>0.36未満：細め／0.36〜0.40：ふつう／0.40超：幅広（目安）</td>
      </tr>
    </table>

    <p>
      <strong>足幅タイプ：</strong>
      ${widthType}
      <span class="result-tag ${widthTagClass}">${widthType}</span>
    </p>
    <p>${widthComment}</p>

    <p>
      <strong>つま先の形：</strong>
      ${toeType}
      <span class="result-tag ${toeTagClass}">${toeType}</span>
    </p>
    <p>${toeComment}</p>

    <p style="font-size:0.8rem;color:#555;">
      ※ この診断はあくまで写真とタップ位置に基づく簡易的な推定です。<br>
      実際のサイズ選びでは、メーカーごとのワイズ表示や試し履きも合わせて確認してください。
    </p>
  `;

  updateInstruction("診断が完了しました。別の写真で試したい場合は、もう一度写真を撮る / 選ぶ を押してください。");
}

// 2点間の距離
function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ====== UI 更新系 ======
function updateInstruction(text) {
  const inst = document.getElementById("instruction");
  inst.textContent = text;
}

function updateResultInitial() {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    画像を読み込みました。<br>
    指示に従って 6 か所のポイントをタップすると診断結果が表示されます。
  `;
}
