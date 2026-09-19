import type { Metadata } from 'next';
import ExamApp from '@/components/exam/ExamApp';

export const metadata: Metadata = {
  title: 'Sınaq – Rəqəm Sistemləri',
};

export default function ExamPage() {
  return <ExamApp />;
}
