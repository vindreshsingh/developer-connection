import { classNames } from '@/commonUtils/classNames';
import './ImagePreview.scss';

const SHAPE_MODIFIER = {
  circle: 'dc-image-preview--circle w-20 h-20',
  banner: 'dc-image-preview--banner w-full h-20',
};

export default function ImagePreview({ src, alt, shape = 'banner' }) {
  if (!src) return null;

  return <img src={src} alt={alt} className={classNames('dc-image-preview', SHAPE_MODIFIER[shape])} />;
}
