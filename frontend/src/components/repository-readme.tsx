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
      <div className="section-heading">
        <div>
          <span>项目文档</span>
          <h2 id="readme-heading">README</h2>
        </div>
        {readme ? (
          <a className="readme-source" href={readme.html_url} target="_blank" rel="noreferrer">
            {readme.path} <ArrowUpRight size={14} />
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
