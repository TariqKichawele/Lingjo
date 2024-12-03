'use server'

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { Message } from "@prisma/client";
import prisma from "../../db";
import { revalidatePath } from "next/cache";

export async function sendMessageToDB(
    message: string, 
    conversationId: string, 
    role: string
): Promise<Message | undefined> {
    try {
        const { getUser } = getKindeServerSession();
        const user = await getUser();

        if(!user) {
            throw new Error("User not found.")
        }

        const conversation = await prisma.conversation.findUnique({
            where: {
                id: conversationId,
                userId: user.id
            }
        });

        if(!conversation) {
            throw new Error("Conversation not found.")
        }

        const newMessage = await prisma.message.create({
            data: {
                content: message,
                role: role,
                conversationId: conversationId
            }
        });

        return newMessage;
    } catch (error) {
        console.error(error);
        throw new Error("An error occured sending the message to the database.")
    }
}

export async function saveGrammrImprovements(
    messageId: string,
    correction: {
        original: string;
        corrected: string;
        focus: string;
    }
) {
    try {
        const { getUser } = getKindeServerSession();
        const user = await getUser();

        if(!user) {
            throw new Error("User not found.")
        }

        const message = await prisma.message.findUnique({
            where: {
                id: messageId
            }
        });

        if(!message) {
            throw new Error("Message not found.")
        }

        const createCorrection = await prisma.correction.create({
            data: {
                ...correction,
                messageId
            }
        });

        const updatedMessage = await prisma.message.update({
            where: {
                id: messageId
            },
            data: {
                improvements: {
                    connect: {
                        id: createCorrection.id
                    }
                }
            }
        });

        if(!updatedMessage) {
            throw new Error("An error occured updating the message.")
        }

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                weaknesses: {
                    push: correction.focus
                }
            }
        });

        revalidatePath(`/chat/${updatedMessage.conversationId}`);
    } catch (error) {
        console.error(error);
        throw new Error("An error occured saving the grammar correction.")
    }
}

export async function deleteGrammarImprovement(conversationId: string, messageId: string) {
    try {
        await prisma.correction.delete({
            where: {
                id: messageId
            },
        });

        revalidatePath(`/chat/${conversationId}`);
    } catch (error) {
        console.error(error);
        throw new Error("An error occured deleting the grammar correction.")
    }
}