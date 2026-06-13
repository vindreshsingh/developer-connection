import { useState } from 'react';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';
import FileInput from '@/components/FileInput/FileInput';
import ImagePreview from '@/components/ImagePreview/ImagePreview';
import { SUPPORTED_LANGUAGES } from '@/widgets/SnippetBlock/snippetLanguages';
import { useCreatePostMutation, useUploadPostImageMutation } from '@/hooks/posts/postApi';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import './CreatePostBox.scss';

const MAX_IMAGES = 4;

export default function CreatePostBox() {
  const { user } = useCurrentUser();
  const [createPost, { isLoading: isPosting }] = useCreatePostMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadPostImageMutation();

  const [content, setContent] = useState('');
  const [snippetMode, setSnippetMode] = useState(false);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');

  const toggleSnippetMode = () => {
    setSnippetMode((prev) => !prev);
    setCode('');
  };

  const handleImageSelect = async (file) => {
    setError('');
    try {
      const { url } = await uploadImage(file).unwrap();
      setImages((prev) => [...prev, url]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Image upload failed'));
    }
  };

  const removeImage = (url) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const trimmedContent = content.trim();
  const trimmedCode = code.trim();
  const isEmpty = !trimmedContent && !trimmedCode && images.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEmpty || isPosting) return;

    setError('');
    try {
      await createPost({
        content: trimmedContent,
        codeSnippet: trimmedCode ? { code: trimmedCode, language } : undefined,
        images,
      }).unwrap();

      setContent('');
      setCode('');
      setSnippetMode(false);
      setImages([]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create post'));
    }
  };

  return (
    <form className="dc-create-post-box" onSubmit={handleSubmit}>
      <div className="dc-create-post-box-header">
        <Avatar user={user} />
        <FormInput
          as="textarea"
          placeholder="Share something with your network…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          wrapperClassName="dc-create-post-box-input"
          className="dc-create-post-box-textarea"
          rows={3}
          maxLength={3000}
        />
      </div>

      {snippetMode && (
        <div className="dc-create-post-box-snippet">
          <select
            className="dc-create-post-box-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Snippet language"
          >
            {SUPPORTED_LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            className="dc-create-post-box-code-area"
            placeholder="Paste or type your code here…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={6}
            maxLength={10000}
            spellCheck={false}
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="dc-create-post-box-images">
          {images.map((url) => (
            <div key={url} className="dc-create-post-box-image">
              <ImagePreview src={url} alt="Attached" shape="banner" />
              <button
                type="button"
                className="dc-create-post-box-image-remove"
                onClick={() => removeImage(url)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="dc-create-post-box-error">{error}</p>}

      <div className="dc-create-post-box-actions">
        <button
          type="button"
          className={`dc-create-post-box-mode-btn${snippetMode ? ' dc-create-post-box-mode-btn--active' : ''}`}
          onClick={toggleSnippetMode}
          title={snippetMode ? 'Remove code snippet' : 'Add a code snippet'}
          aria-pressed={snippetMode}
        >
          {'</>'}
        </button>

        <FileInput
          onSelect={handleImageSelect}
          disabled={isUploading || images.length >= MAX_IMAGES}
          hint={isUploading ? 'Uploading…' : `Add image (${images.length}/${MAX_IMAGES})`}
        />

        <Button type="submit" disabled={isEmpty || isPosting} className="dc-create-post-box-submit">
          {isPosting ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
