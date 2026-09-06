import Image from "next/image";

interface RepositoryAvatarProps {
  owner: string;
  size?: number;
}

export function RepositoryAvatar({ owner, size = 42 }: RepositoryAvatarProps) {
  return (
    <Image
      className="repo-avatar"
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=${size * 2}`}
      alt={`${owner} 头像`}
      width={size}
      height={size}
      unoptimized
    />
  );
}

