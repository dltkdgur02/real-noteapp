// utils/ai.ts
import OpenAI from "openai";

const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
export const openai = new OpenAI({
    apiKey: String(apiKey || ""),
    dangerouslyAllowBrowser: true,
});

export async function runAI(system: string, user: string, opts?: {temperature?: number}) {
    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: opts?.temperature ?? 0.3,
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
    });
    return res.choices?.[0]?.message?.content?.trim() || "";
}

/** 공통 프롬프트: 문서 본문을 받아 다양한 작업 수행 */
export const prompts = {
    summarize: (text: string) =>
        `다음 문서를 한국어로 핵심 bullet 5~8개로 요약하고 한 문장 TL;DR도 끝에 추가해줘.\n\n---\n${text}`,

    quiz: (text: string) =>
        `다음 문서로 객관식 퀴즈 6문항을 만들어줘. 쉬움/보통/어려움 각 2문항. 형식은\nQ) ...\nA) ①… ②… ③… ④…\n정답: 번호\n해설: 한 줄\n으로 통일.\n\n---\n${text}`,

    keywords: (text: string) =>
        `다음 문서의 핵심 키워드 10~15개를 중요도 순으로 나열하고, 각 키워드 옆에 1줄 설명을 붙여줘.\n\n---\n${text}`,

    flashcards: (text: string) =>
        `다음 내용을 Anki 스타일 플래시카드 12장으로 만들어줘.\nFront: ...\nBack: ...\n형식을 꼭 지켜줘.\n\n---\n${text}`,

    studyPlan: (text: string) =>
        `다음 문서를 1주 학습 계획으로 쪼개줘. Day1~Day7로 나누고, 매일 학습목표/핵심개념/연습문제 아이디어/체크포인트를 bullet로 정리해줘.\n\n---\n${text}`,

    explain: (question: string, context?: string) =>
        `질문에 대해 한국어로 간결하고 예시 중심으로 설명해줘. 가능하면 단계별로.\n질문: ${question}\n\n참고 문맥(있다면):\n${context || "(없음)"}`,

    translate: (text: string, toLang: string) =>
        `다음 텍스트를 ${toLang}로 자연스럽게 번역하고, 전문 용어는 괄호로 원문을 병기해줘.\n\n---\n${text}`,
};
