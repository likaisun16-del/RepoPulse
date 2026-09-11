import Image from "next/image";

interface RepositoryAvatarProps {
  owner: string;
  ownerGithubId?: number | null;
  size?: number;
}

export function RepositoryAvatar({ owner, ownerGithubId, size = 42 }: RepositoryAvatarProps) {
  return (
    <Image
      className="repo-avatar"
      src={ownerGithubId ? `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/v1/avatars/${ownerGithubId}` : "/avatar-fallback.svg"}
      alt={`${owner} 头像`}
      width={size}
      height={size}
      unoptimized
      onError={(event) => { event.currentTarget.src = "/avatar-fallback.svg"; }}
    />
  );
}
