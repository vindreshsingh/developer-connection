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
import { classNames } from '@/commonUtils/classNames';

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
    <form
      className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <FormInput
          as="textarea"
          placeholder="Share something with your network…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          wrapperClassName="flex-1"
          className="w-full resize-y min-h-[3rem]"
          rows={3}
          maxLength={3000}
        />
      </div>

      {snippetMode && (
        <div className="flex flex-col gap-2">
          <select
            className="self-start rounded-md border border-gray-300 bg-white px-2 py-1 text-[0.8rem] text-gray-700 cursor-pointer focus:outline focus:outline-2 focus:outline-indigo-400 focus:outline-offset-1"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Snippet language"
          >
            {SUPPORTED_LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-[0.8rem] font-mono leading-relaxed text-gray-800 [tab-size:2] placeholder:text-gray-400 focus:outline focus:outline-2 focus:outline-indigo-400 focus:outline-offset-1"
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
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(6rem,1fr))]">
          {images.map((url) => (
            <div key={url} className="relative">
              <ImagePreview src={url} alt="Attached" shape="banner" />
              <button
                type="button"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-base leading-none text-white hover:bg-black/75"
                onClick={() => removeImage(url)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={classNames(
            'flex-shrink-0 whitespace-nowrap rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 font-mono text-xs font-bold text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700',
            snippetMode && 'border-violet-300 bg-violet-100 text-violet-700',
          )}
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

        <Button type="submit" disabled={isEmpty || isPosting} className="ml-auto">
          {isPosting ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
