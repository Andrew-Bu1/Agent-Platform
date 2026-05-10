import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color?: string;
}

export default function PlaceholderPage({ title, description, icon: Icon, color = 'text-brand-600' }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 text-sm max-w-xs">{description}</p>
    </div>
  );
}
