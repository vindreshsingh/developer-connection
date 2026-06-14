import FormInput from '@/components/FormInput/FormInput';
import Tag from '@/components/Tag/Tag';

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
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <Tag key={`${tag}-${i}`}>{tag}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}
