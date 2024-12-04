import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import React from 'react'
import db from '../../../../db';
import { notFound } from 'next/navigation';
import MaxWidthWrapper from '@/components/common/MaxWidthWrapper';
import Quiz from '@/components/Quiz';

const Page = async({ params } : { params: { quizId: string } }) => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();


    const { quizId } = await params;

    const quiz = await db.quiz.findUnique({
        where: {
            id: quizId,
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

    if(!quiz) {
        return notFound();
    }


  return (
    <MaxWidthWrapper>
      <Quiz quiz={quiz} />
    </MaxWidthWrapper>
  )
}

export default Page