import { classNames } from '@/commonUtils/classNames';
import './Tag.scss';

export default function Tag({ className = '', children }) {
  return <span className={classNames('dc-tag', className)}>{children}</span>;
}
