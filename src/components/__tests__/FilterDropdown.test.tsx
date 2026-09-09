// src/components/__tests__/FilterDropdown.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterDropdown from '@/components/FilterDropdown';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

describe('FilterDropdown', () => {
  it('renders placeholder text when value does not match any option', () => {
    render(
      <FilterDropdown
        value={'unknown' as string}
        onChange={jest.fn()}
        placeholder="Choose one"
        options={OPTIONS}
      />
    );
    expect(screen.getByRole('button', { name: /Choose one/i })).toBeInTheDocument();
  });

  it('shows the selected option label in the trigger when value matches', () => {
    render(
      <FilterDropdown
        value="left"
        onChange={jest.fn()}
        placeholder="Choose one"
        options={OPTIONS}
      />
    );
    expect(screen.getByRole('button', { name: /Left/i })).toBeInTheDocument();
  });

  it('opens the panel and shows options when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown value="all" onChange={jest.fn()} placeholder="Choose one" options={OPTIONS} />
    );

    // Panel options are not visible before click
    expect(screen.queryAllByRole('button')).toHaveLength(1);

    await user.click(screen.getByRole('button'));

    // After click: trigger + 3 option buttons
    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(4);
    });
  });

  it('calls onChange with the selected value and closes the panel', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FilterDropdown value="all" onChange={onChange} placeholder="Choose one" options={OPTIONS} />
    );

    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(4));

    // Click the "Left" option (not the trigger)
    const buttons = screen.getAllByRole('button');
    const leftButton = buttons.find((b) => b.textContent === 'Left')!;
    await user.click(leftButton);

    expect(onChange).toHaveBeenCalledWith('left');
    // Panel closed: only trigger button remains
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(1));
  });

  it('closes the panel when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown value="all" onChange={jest.fn()} placeholder="Choose one" options={OPTIONS} />
    );

    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(4));

    // mousedown outside the dropdown closes it
    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(1));
  });

  it('positions the panel above the trigger when near the bottom of the viewport', async () => {
    const user = userEvent.setup();

    // Mock button near the bottom of a 768px viewport
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 700,
      top: 680,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 680,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    render(
      <FilterDropdown value="all" onChange={jest.fn()} placeholder="Choose one" options={OPTIONS} />
    );

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // The panel wraps the option buttons — get its parent
      const panel = buttons[1].parentElement as HTMLElement;
      // Opens above: top = 680 - 300 - 4 = 376, which is less than rect.top (680)
      expect(parseInt(panel.style.top)).toBeLessThan(680);
      expect(parseInt(panel.style.top)).toBe(376);
    });

    jest.restoreAllMocks();
  });
});
