import type { VersionTokenCategory } from '../contracts/filename-analysis';

export interface VersionDictionaryEntry {
  term: string;
  normalized: string;
  category: Exclude<VersionTokenCategory, 'numeric'>;
  weight: number;
}

function entries(
  category: VersionDictionaryEntry['category'],
  weight: number,
  terms: string[],
): VersionDictionaryEntry[] {
  return terms.map((term) => ({ term, normalized: term, category, weight }));
}

export const VERSION_DICTIONARY: VersionDictionaryEntry[] = [
  ...entries('draft', 0.35, ['初稿', '草稿', 'draft', 'first', '第一版', '首版', '原版']),
  ...entries('revision', 0.55, [
    '修改版',
    '修订版',
    '已修改',
    'revision',
    'updated',
    '修改',
    '修订',
    '更新',
    'update',
    'rev',
    '改',
  ]),
  ...entries('new', 0.45, ['最新版', '新新版', 'latest', '新版', 'new', '新']),
  ...entries('final', 0.75, [
    '真的最终',
    '最终版',
    '确认版',
    '正式版',
    '最后版',
    'finalized',
    '最终',
    '定稿',
    '终稿',
    'final',
  ]),
  ...entries('submitted', 0.7, [
    'submission',
    'deliverable',
    'submitted',
    '提交版',
    '已提交',
    '送审版',
    '交付版',
    '提交',
    '送审',
    '交付',
  ]),
  ...entries('copy', 0.25, ['副本', '复制', 'copy', '复件', '另存']),
  ...entries('backup', 0.2, ['backup', 'archive', '备份', '旧版', '历史', 'bak']),
  ...entries('temporary', 0.1, [
    'preview',
    '临时',
    '测试',
    '预览',
    'temp',
    'test',
    'tmp',
  ]),
].sort((left, right) => right.term.length - left.term.length);

export const GENERIC_STOP_WORDS = [
  '项目',
  '方案',
  '报告',
  '文件',
  '材料',
  '附件',
  '文档',
  '表格',
  '说明',
  '版本',
  '最终',
  '修改',
  '新',
];
