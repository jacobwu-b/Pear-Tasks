import { useState } from 'react';
import { useTaskStore } from '../../store/taskStore';

interface Props {
  projectId: string;
}

export default function ProjectHeader({ projectId }: Props) {
  const projects = useTaskStore((s) => s.projects);
  const updateProjectField = useTaskStore((s) => s.updateProjectField);
  const project = projects.find((p) => p.id === projectId) ?? null;

  // Local draft for the notes textarea, synced when the selected project
  // changes. Mirrors the pattern in TaskDetail so in-flight saves don't
  // clobber keystrokes the user is still typing.
  const [notes, setNotes] = useState('');
  const [syncedProjectId, setSyncedProjectId] = useState<string | null>(null);

  if (project && project.id !== syncedProjectId) {
    setSyncedProjectId(project.id);
    setNotes(project.notes);
  }

  if (!project) return null;

  const handleNotesBlur = () => {
    if (notes === project.notes) return;
    void updateProjectField(project.id, { notes });
  };

  return (
    <div className="flex-1 min-w-0">
      <h1
        className="text-2xl font-bold"
        data-testid="view-title"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {project.title}
      </h1>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesBlur}
        data-testid="project-description-input"
        rows={2}
        placeholder="Add a description..."
        className="w-full mt-2 text-sm bg-transparent outline-none resize-y p-2 rounded"
        style={{
          border: '1px solid var(--color-border-primary)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}
