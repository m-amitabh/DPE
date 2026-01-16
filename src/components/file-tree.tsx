import { useState } from 'react';
import { ChevronRight, ChevronDown, File, FileCode, FileImage, FileText, Folder } from 'lucide-react';
import type { FileTreeNode } from '../lib/types';
import { formatBytes } from '../lib/utils-project';

interface FileTreeProps {
  tree: FileTreeNode;
  onFileSelect?: (node: FileTreeNode) => void;
}

/**
 * Recursive file tree component with expand/collapse
 */
export function FileTree({ tree, onFileSelect }: FileTreeProps) {
  return (
    <div className="font-mono text-sm">
      <TreeNode node={tree} level={0} onFileSelect={onFileSelect} />
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  onFileSelect?: (node: FileTreeNode) => void;
}

function TreeNode({ node, level, onFileSelect }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0); // Root is expanded by default
  const isDirectory = node.type === 'directory';
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect?.(node);
    }
  };

  const Icon = getFileIcon(node);
  const iconColor = getIconColor(node);

  return (
    <div>
      {/* Node row */}
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-accent rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse chevron (only for directories) */}
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {hasChildren && (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}

        {/* File/folder icon */}
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />

        {/* Name */}
        <span className="flex-1 truncate text-foreground group-hover:text-accent-foreground">
          {node.name}
        </span>

        {/* Size (only for files) */}
        {!isDirectory && (
          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
            {formatBytes(node.size)}
          </span>
        )}
      </div>

      {/* Children (if directory is expanded) */}
      {isDirectory && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Get appropriate icon for file/folder
 */
function getFileIcon(node: FileTreeNode) {
  if (node.type === 'directory') {
    return Folder;
  }

  const ext = node.name.split('.').pop()?.toLowerCase();
  
  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'rb', 'php'].includes(ext || '')) {
    return FileCode;
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) {
    return FileImage;
  }

  // Text/markdown files
  if (['md', 'txt', 'json', 'yaml', 'yml', 'xml', 'csv'].includes(ext || '')) {
    return FileText;
  }

  // Default file icon
  return File;
}

/**
 * Get color class for icon based on file type
 */
function getIconColor(node: FileTreeNode): string {
  if (node.type === 'directory') {
    return 'text-blue-500';
  }

  const ext = node.name.split('.').pop()?.toLowerCase();

  // Language-specific colors
  if (['ts', 'tsx'].includes(ext || '')) return 'text-blue-600';
  if (['js', 'jsx'].includes(ext || '')) return 'text-yellow-600';
  if (ext === 'py') return 'text-green-600';
  if (['java'].includes(ext || '')) return 'text-red-600';
  if (['cpp', 'c', 'h'].includes(ext || '')) return 'text-purple-600';
  if (ext === 'rs') return 'text-orange-600';
  if (ext === 'go') return 'text-cyan-600';
  
  // Markdown/text
  if (['md', 'txt'].includes(ext || '')) return 'text-gray-600';
  
  // Config files
  if (['json', 'yaml', 'yml', 'xml'].includes(ext || '')) return 'text-amber-600';

  // Default
  return 'text-muted-foreground';
}
