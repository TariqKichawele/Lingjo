import MaxWidthWrapper from '@/components/common/MaxWidthWrapper'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import React from 'react'
import db from '../../../db';
import Dashboard from '@/components/Dashboard';

const Page = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if(!user) {
    redirect('/');
  }

  const quizzes = await db.quiz.findMany({
    where: {
      userId: user.id
    },
    include: {
      questions: true
    }
  });

  const conversations = await db.conversation.findMany({
    where: {
      userId: user.id
    },
    include: {
      message: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });


  return (
    <MaxWidthWrapper>
      <Dashboard quizzes={quizzes} conversations={conversations} />
    </MaxWidthWrapper>
  )
}

export default Page