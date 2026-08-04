import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { useProjectStore } from '@/store/project.store';
import { reportResult } from '../fixtures/report-result';

describe('project report UI', () => {
  beforeEach(() => {
    useProjectStore.getState().clear();
    window.location.hash = '#/report/overview';
  });

  it('shows a recoverable empty state without an in-memory report', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '还没有可查看的项目报告' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '开始本地调查' })).toHaveAttribute('href', '#/scan');
  });

  it('presents the report summary and opens structured evidence', () => {
    useProjectStore.getState().setResult(reportResult);
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: '产品策划案' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '现有元数据呈现出 1 个可能的文件家族' })).toBeInTheDocument();
    expect(screen.getByText('可能存在多个正式版本')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();

    fireEvent.click(screen.getByText('展开候选证据（3）'));
    expect(screen.getByText(/属于最近活跃文件/)).toBeVisible();
  });

  it('navigates from a candidate to its file investigation record', () => {
    useProjectStore.getState().setResult(reportResult);
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: '产品策划案_提交版.docx' }));
    expect(screen.getByRole('heading', { name: '产品策划案_提交版.docx' })).toBeInTheDocument();
    expect(screen.getByText('单个文件调查档案')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设为主版本' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记为废弃' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记为副本' })).toBeInTheDocument();
    expect(screen.getByText('这些操作只会修正分析报告，不会修改原始文件。可使用报告顶栏的撤销按钮恢复上一步。')).toBeInTheDocument();
    expect(screen.getByText('此档案只展示基于元数据的推测，不读取正文，也不会修改、移动、重命名或删除原始文件。')).toBeInTheDocument();
  });
});
