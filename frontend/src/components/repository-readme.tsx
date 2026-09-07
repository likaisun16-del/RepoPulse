import { ArrowUpRight, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { ReadmeResponse } from "@/lib/types";

interface RepositoryReadmeProps {
  readme: ReadmeResponse | null;
}

export function RepositoryReadme({ readme }: RepositoryReadmeProps) {
  return (
    <section className="readme-section" aria-labelledby="readme-heading">
      <div className="readme-heading">
        <div className="readme-heading-copy">
          <span className="readme-heading-icon" aria-hidden="true">
            <FileText size={19} />
          </span>
          <div>
            <h2 id="readme-heading">项目文档</h2>
            <p>仓库 README 原文</p>
          </div>
        </div>
        {readme ? (
          <a
            className="readme-source"
            href={readme.html_url}
            target="_blank"
            rel="noreferrer"
            aria-label={`在 GitHub 查看 ${readme.path}`}
            title={readme.path}
          >
            <span className="readme-source-path">{readme.path}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {readme ? (
        <article className="readme-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {readme.content}
          </ReactMarkdown>
        </article>
      ) : (
        <div className="readme-empty">
          <FileText size={22} />
          <strong>README 暂不可用</strong>
          <p>GitHub 暂未提供可读取的 README 内容。</p>
        </div>
      )}
    </section>
  );
}
