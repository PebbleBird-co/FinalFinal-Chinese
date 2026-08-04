import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '@/app/App';

describe('application shell', () => {
  it('presents the product output and local privacy boundary', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '从混乱文件夹里，还原一个项目的版本历史。',
    );
    expect(screen.getByLabelText('分析结果示例')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '不读取正文' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '完全本地分析' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '不修改原文件' })).toBeInTheDocument();
  });

  it('opens the read-only scan workflow from the primary CTA', () => {
    render(<App />);

    const scanLinks = screen.getAllByRole('link', { name: '选择项目文件夹' });
    fireEvent.click(scanLinks[0]);
    expect(
      screen.getByRole('heading', { level: 1, name: '开始一次本地文件调查' }),
    ).toBeInTheDocument();
    expect(screen.getByText('浏览器预览模式：请启动桌面应用进行扫描。')).toBeInTheDocument();
  });
});
