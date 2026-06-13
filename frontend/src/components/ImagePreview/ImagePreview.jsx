import { classNames } from '@/commonUtils/classNames';

const SHAPE_MODIFIER = {
  circle: 'rounded-full w-20 h-20',
  banner: 'rounded-lg w-full h-20',
};

export default function ImagePreview({ src, alt, shape = 'banner' }) {
  if (!src) return null;

  return <img src={src} alt={alt} className={classNames('mb-2 object-cover', SHAPE_MODIFIER[shape])} />;
}
