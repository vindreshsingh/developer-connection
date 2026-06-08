import FormInput from '@/components/FormInput/FormInput';
import Tag from '@/components/Tag/Tag';
import './TechStackEditor.scss';

export default function TechStackEditor({ value, onChange }) {
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div>
      <FormInput
        label="Tech stack (comma separated)"
        value={value}
        onChange={onChange}
        placeholder="TypeScript, Express, Docker"
      />
      {tags.length > 0 && (
        <div className="dc-tech-stack-editor-tags">
          {tags.map((tag, i) => (
            <Tag key={`${tag}-${i}`}>{tag}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}
