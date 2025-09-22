// utils/ai.ts (Expo Go 전용, fetch 기반)
const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const API_BASE = process.env.EXPO_PUBLIC_OPENAI_API_BASE || "https://api.openai.com/v1";

if (!API_KEY) {
    console.warn("[AI] EXPO_PUBLIC_OPENAI_API_KEY가 설정되어 있지 않다. .env 확인이 필요하다.");
}

// 공통 호출 래퍼: chat.completions
async function callChat({
                            model = "gpt-4o-mini",
                            temperature = 0.3,
                            system,
                            user,
                            maxTokens,
                        }: {
    model?: string;
    temperature?: number;
    system: string;
    user: string;
    maxTokens?: number;
}) {
    const resp = await fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            temperature,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            max_tokens: maxTokens,
        }),
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`OpenAI ${resp.status}: ${text}`);
    }

    const json = await resp.json();
    return (json.choices?.[0]?.message?.content ?? "").trim();
}

export async function runAI(
    system: string,
    user: string,
    opts?: { temperature?: number; model?: string; maxTokens?: number }
) {
    return callChat({
        model: opts?.model || "gpt-4o-mini",
        temperature: opts?.temperature ?? 0.3,
        system,
        user,
        maxTokens: opts?.maxTokens,
    });
}

/* -------------------------------------------------------
   긴 텍스트 대응: 자동 분할(Map-Reduce)
-------------------------------------------------------- */
const CHUNK_SIZE = 18000;

function splitText(text: string, size = CHUNK_SIZE): string[] {
    if (text.length <= size) return [text];
    const parts: string[] = [];
    let cur = 0;
    while (cur < text.length) {
        let end = Math.min(cur + size, text.length);
        const slice = text.slice(cur, end);
        const cut = slice.lastIndexOf("\n\n");
        if (cut > size * 0.6) end = cur + cut;
        parts.push(text.slice(cur, end));
        cur = end;
    }
    return parts;
}

const summarizeChunkPrompt = (chunk: string, i: number, total: number) => `
다음은 원문 ${i}/${total} 조각이다. 아래 구조로 "길고 자세하게" 요약한다.
- 핵심 요지(3~5문장)
- 주요 개념/용어 정리(5~10개, 각 1~2문장)
- 핵심 논리 전개(항목형, 가능한 한 상세)
- 중요한 공식/정의/법칙(있으면)
- 예시/사례(있으면)
---
${chunk}
`;

const mergeSummariesPrompt = (partials: string[]) => `
아래 부분 요약들을 중복/모순 없이 하나의 "보고서형 장문 요약"으로 통합한다.
섹션 구조로 작성한다:
1) Executive Summary (5~8문장)
2) 핵심 개념 및 용어 정리 (표기: 개념 - 설명)
3) 상세 개요(Outline) (번호/하위항목 포함, 충분히 길게)
4) 중요한 공식·정의·법칙 (수식은 가능한 한 평문으로 병기)
5) 예시 및 적용 시나리오
6) 한 문장 TL;DR
---
${partials.map((p, idx) => `## 부분 ${idx + 1}\n${p}`).join("\n\n")}
`;

// ✅ prompts 의존 제거
export async function summarizeSmart(
    fullText: string,
    opts?: { temperature?: number; model?: string }
) {
    const system =
        "너는 학습 보조용 보고서를 작성하는 조교다. 한국어로 길고 자세하며 구조적으로 작성한다.";
    if (!fullText?.trim()) return "";

    const chunks = splitText(fullText);

    // 단일 조각: 직접 장문 프롬프트 구성
    if (chunks.length === 1) {
        const user = `
아래 문서를 바탕으로 '길고 자세한 보고서형 요약'을 작성하라.
섹션 구조를 사용하고, 항목을 충분히 늘려라.
1) Executive Summary (5~8문장)
2) 핵심 개념 및 용어 정리 (개념 - 설명)
3) 상세 개요(Outline) (번호/하위항목 포함)
4) 중요한 공식·정의·법칙 (있으면)
5) 예시 및 적용 시나리오
6) 한 문장 TL;DR
---
${fullText}`;
        return runAI(system, user, {
            temperature: opts?.temperature ?? 0.3,
            model: opts?.model,
        });
    }

    // 다중 조각: 부분 요약 → 병합
    const partials: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const out = await runAI(system, summarizeChunkPrompt(chunks[i], i + 1, chunks.length), {
            temperature: 0.2,
            model: opts?.model,
        });
        partials.push(out);
    }

    return runAI(system, mergeSummariesPrompt(partials), {
        temperature: opts?.temperature ?? 0.3,
        model: opts?.model,
    });
}

export async function quizSmart(
    fullText: string,
    count = 12,
    opts?: { temperature?: number; model?: string }
) {
    const system =
        "너는 학습 평가를 위한 출제 조교다. 정확하고 공정하며 해설을 충분히 제공한다.";
    if (!fullText?.trim()) return "";

    const basis =
        fullText.length > CHUNK_SIZE
            ? await summarizeSmart(fullText, { model: opts?.model, temperature: 0.2 })
            : fullText;

    const user = `
다음 내용을 바탕으로 객관식 ${count}문항을 만든다.
- 난이도: 쉬움/보통/어려움이 고르게 섞이도록
- 보기 4지선다, 오답은 그럴듯하지만 틀린 이유가 명확해야 함
- 각 문항에 "정답: 번호"와 "해설: 2~3문장"을 반드시 포함
- 문항은 중복 없이 넓은 범위를 커버
형식(꼭 지켜라):
Q) ...
A) ①… ②… ③… ④…
정답: 번호
해설: ...
---
${basis}`;
    return runAI(system, user, {
        temperature: opts?.temperature ?? 0.4,
        model: opts?.model,
    });
}
