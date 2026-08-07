import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabPanel } from './Tabs.jsx';

const TABS = [
  { key: 'a', label: 'Tab A' },
  { key: 'b', label: 'Tab B' },
  { key: 'c', label: 'Tab C' },
];

function Harness({ initial = 'a' }) {
  const [tab, setTab] = useState(initial);
  return (
    <>
      <Tabs
        id="demo"
        label="Demo labels"
        tabs={TABS}
        active={tab}
        onChange={setTab}
      />
      <TabPanel id="demo" tabKey="a" active={tab === 'a'}>
        <p>Panel A</p>
      </TabPanel>
      <TabPanel id="demo" tabKey="b" active={tab === 'b'}>
        <p>Panel B</p>
      </TabPanel>
      <TabPanel id="demo" tabKey="c" active={tab === 'c'}>
        <p>Panel C</p>
      </TabPanel>
      <button type="button" id="outside">
        Outside
      </button>
    </>
  );
}

const tab = (name) => screen.getByRole('tab', { name });

describe('Tabs (WAI-ARIA pattern, A11Y-A4 / UX-12)', () => {
  it('renders tablist with a tab per entry carrying id/aria-selected/roving tabindex', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Demo labels' });
    expect(list).toBeInTheDocument();

    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Tab A', 'Tab B', 'Tab C']);

    // id, aria-controls và tabindex (roving)
    expect(tab('Tab A')).toHaveAttribute('id', 'demo-tab-a');
    expect(tab('Tab A')).toHaveAttribute('aria-controls', 'demo-panel-a');
    // chỉ tab đang chọn nằm trong tab order
    expect(tab('Tab A')).toHaveAttribute('tabindex', '0');
    expect(tab('Tab B')).toHaveAttribute('tabindex', '-1');
    expect(tab('Tab C')).toHaveAttribute('tabindex', '-1');
  });

  it('đánh dấu đúng tab được chọn (aria-selected) và tabpanel tương ứng hiển thị', () => {
    render(<Harness initial="b" />);
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'false');
    // tab B nằm trong tab order, các tab khác bị loại
    expect(tab('Tab B')).toHaveAttribute('tabindex', '0');

    // panel tương ứng: id khớp aria-controls, aria-labelledby trỏ về tab, hidden theo active
    const panelB = screen.getByRole('tabpanel', { name: 'Tab B' });
    expect(panelB).toHaveAttribute('id', 'demo-panel-b');
    expect(panelB).toHaveAttribute('aria-labelledby', 'demo-tab-b');
    expect(panelB).not.toHaveAttribute('hidden');
    expect(screen.getByText('Panel B')).toBeVisible();
    expect(screen.getByText('Panel A')).not.toBeVisible();
    expect(screen.getByText('Panel C')).not.toBeVisible();
  });

  it('click chuyển tab và cập nhật trạng thái selected', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(tab('Tab C'));
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Panel C')).toBeVisible();
  });

  it('ArrowRight khi tab đang focus chuyển sang tab kế tiếp và di chuyển focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab(); // focus Tab A (tabindex 0)
    expect(tab('Tab A')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab B')).toHaveFocus();
    expect(tab('Tab B')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(tab('Tab C')).toHaveFocus();
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft quay lại tab trước và bọc vòng (wrap-around)', async () => {
    const user = userEvent.setup();
    render(<Harness initial="a" />);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    // wrap: từ tab đầu tiên sang tab cuối
    expect(tab('Tab C')).toHaveFocus();
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
  });

  it('Home/End nhảy tới tab đầu/cuối', async () => {
    const user = userEvent.setup();
    render(<Harness initial="c" />);
    await user.tab(); // focus Tab C (active → tabindex 0)
    await user.keyboard('{Home}');
    expect(tab('Tab A')).toHaveFocus();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tab('Tab C')).toHaveFocus();
    expect(tab('Tab C')).toHaveAttribute('aria-selected', 'true');
  });

  it('phím mũi tên KHÔNG đổi tab khi focus nằm ngoài tablist', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const outside = screen.getByRole('button', { name: 'Outside' });
    await user.click(outside);
    expect(outside).toHaveFocus();
    // Khối xử lý phím nằm trên tablist (bubbling), không phải window → focus ngoài
    // tablist thì phím mũi tên không đổi tab và không cướp focus.
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    expect(outside).toHaveFocus();
    expect(tab('Tab A')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Tab A')).not.toHaveFocus();
  });
});