'use server'

import openai from "@/lib/openai"
import { z } from "zod"
import { zodResponseFormat } from 'openai/helpers/zod'
import { ChatCompletionMessageParam } from "openai/resources/index.mjs"
import { Message } from "@prisma/client"
import prisma from "../../db"
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"

const messageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
});

const grammarSchema = z.object({
    original: z.string(),
    corrected: z.string(),
    focus: z.string(),
})

const quizSchema = z.object({
    questions: z.array(
        z.object({
            question: z.string(),
            answers: z.array(
                z.object({
                    text: z.string(),
                    correct: z.boolean(),
                })
            )
        })
    )
})

export async function continueConversation(messages: Message[], message: string) {
    try {
        const conversationMessages = [
            {
                role: "system",
                content:
                  "You are a helpful assistant that has conversations to help people learn English. Maintain a natural and engaging conversation style. Do not correct grammar mistakes.",
            },
            ...messages,
            {
                role: "user",
                content: message,
            },
        ];

        const res = await openai.beta.chat.completions.parse({
            messages: conversationMessages as ChatCompletionMessageParam[],
            model: 'gpt-4o-2024-08-06',
            temperature: 0.7,
            response_format: zodResponseFormat(messageSchema, "message")
        });

        if(!res.choices[0].message.parsed) {
            throw new Error("An error occured with the OpenAI API.")
        }

        return res.choices[0].message.parsed;
    } catch (error) {
        console.error(error);
        throw new Error("An error occured with the OpenAI API.")
    }
}

export async function findGrammarImprovements(message: string) {
    try {
        const res = await openai.beta.chat.completions.parse({
            messages: [
                {
                  role: "system",
                  content:
                    "You are an expert at correcting grammar. You will be given a message and you need to correct the grammar. You need to summarize the grammar issue as one phrase such as 'Past simple' or 'Present perfect' and then give a suggestion for improvement. Focus purely on grammar mistakes, not vocabulary or regional variations. If there are no grammar mistakes, return a string that simply says 'No grammar mistakes found'.",
                },
                {
                  role: "user",
                  content: `The message is ${message}`,
                },
            ],
            model: 'gpt-4o-2024-08-06',
            temperature: 0.7,
            response_format: zodResponseFormat(grammarSchema, "grammar")
        });
        
        if(!res.choices[0].message.parsed) {
            throw new Error("An error occured with the OpenAI API.")
        }

        return res.choices[0].message.parsed;
    } catch (error) {
        console.error(error);
        throw new Error("An error occured with the OpenAI API.")
    }
}

export async function generateQuizQuestions(focus: string) {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if(!user) {
        throw new Error("User not found.")
    }

    const alreadyQuiz = await prisma.quiz.findFirst({
        where: {
            topic: focus,
            userId: user.id
        },
        include: {
            questions: {
                include: {
                    answers: true,
                }
            }
        }
    });

    if(alreadyQuiz) {
        return {
            topic: alreadyQuiz.topic,
            questions: alreadyQuiz.questions.map((question) => ({
                question: question.text,
                answer: question.answers.map((answer) => ({
                    text: answer.text,
                    correct: answer.correct
                }))
            })),
            id: alreadyQuiz.id
        }
    }

    try {
        const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            response_format: zodResponseFormat(quizSchema, "quiz-structure"),
            messages: [
              {
                role: "system",
                content:
                  "You are an AI assistant that generates multiple choice quizzes. For each question, provide exactly 4 possible answers, with exactly one correct answer.",
              },
              {
                role: "user",
                content: `Generate a quiz on the topic of ${focus}. The context is that the quiz is for someone learning English as a second language. Include 10 multiple choice questions. For each question, provide 4 answers and mark which one is correct.`,
              },
            ],
        });

        if(!response.choices[0].message.parsed) {
            throw new Error("An error occured with the OpenAI API.")
        }

        const parsedResponse = response.choices[0].message.parsed;

        const quiz = await prisma.quiz.create({
              data: {
                topic: focus,
                questions: {
                    create: parsedResponse.questions.map((question) => ({
                        text: question.question,
                        answers: {
                            create: question.answers.map((answer) => ({
                                text: answer.text,
                                correct: answer.correct
                            }))
                        }
                    }))
                },
                userId: user.id
              },
              include: {
                questions: {
                    include: {
                        answers: true
                    }
                }
              }
        });
          
        return { id: quiz.id };
    } catch (error) {
        console.error(error);
        throw new Error("An error occured with the OpenAI API.")
    }
}