import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  try {
    const { imageData } = await request.json();
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `この足の写真を分析して、足の形タイプを判定してください。

以下の3タイプのいずれかを判定してください：

1. エジプト型：親指が一番長く、小指に向かって斜めに短くなる
2. ギリシャ型：人差し指（第2趾）が一番長い
3. スクエア型：親指から中指までがほぼ同じ長さで、揃っている

以下のJSON形式のみで回答してください（JSON以外は絶対に出力しないでください）：
{
  "footType": "エジプト型 or ギリシャ型 or スクエア型",
  "confidence": "高 or 中 or 低",
  "description": "判定理由の説明（50文字程度）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "shoeTips": "おすすめの靴選びのアドバイス（50文字程度）"
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    
    // JSONを抽出
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    return Response.json(parsed);
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json(
      { error: '分析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
