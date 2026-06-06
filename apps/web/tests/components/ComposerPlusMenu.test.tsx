// @vitest-environment jsdom

// Regression coverage for the shared composer "+" menu (replaces the deleted
// ChatComposer.tools-menu-caret.test.tsx, #3195): the connector / plugin / MCP
// pick rows must cancel `mousedown` so the editor keeps focus and the caller's
// insertMention lands at the caret instead of the draft end.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ComposerPlusMenu } from '../../src/components/ComposerPlusMenu';
import { I18nProvider } from '../../src/i18n';
import type { Locale } from '../../src/i18n/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const CONNECTOR = { id: 'c1', name: 'Notion', status: 'connected' } as never;
const PLUGIN = { id: 'p1', title: 'Deck Maker', manifest: {} } as never;
const MCP_SERVER = { id: 'm1', label: 'Linear', enabled: true } as never;

function renderMenu(overrides: Partial<ComponentProps<typeof ComposerPlusMenu>> = {}) {
  const props: ComponentProps<typeof ComposerPlusMenu> = {
    connectors: [CONNECTOR],
    onPickConnector: vi.fn(),
    plugins: [PLUGIN],
    onPickPlugin: vi.fn(),
    mcpServers: [MCP_SERVER],
    onPickMcp: vi.fn(),
    onAttachFiles: vi.fn(),
    triggerTestId: 'plus-trigger',
    ...overrides,
  };
  render(
    <I18nProvider initial={'en' as Locale}>
      <ComposerPlusMenu {...props} />
    </I18nProvider>,
  );
  return props;
}

// A pick row cancels mousedown so focus stays on the editor; assert the
// dispatched mousedown event is defaultPrevented.
function expectPickRowPreventsMousedown(name: RegExp) {
  const row = screen.getByRole('menuitem', { name });
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  row.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
}

describe('ComposerPlusMenu pick-row caret protection', () => {
  it('cancels mousedown on the connector / plugin / MCP pick rows', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('plus-trigger'));

    fireEvent.click(screen.getByRole('menuitem', { name: /Connectors/i }));
    expectPickRowPreventsMousedown(/Notion/i);

    fireEvent.click(screen.getByRole('menuitem', { name: /Plugins/i }));
    expectPickRowPreventsMousedown(/Deck Maker/i);

    fireEvent.click(screen.getByRole('menuitem', { name: /^MCP/i }));
    expectPickRowPreventsMousedown(/Linear/i);
  });

  it('resets the shared search query when switching submenus', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('plus-trigger'));

    fireEvent.click(screen.getByRole('menuitem', { name: /Plugins/i }));
    const pluginSearch = screen.getByPlaceholderText('Plugins') as HTMLInputElement;
    fireEvent.change(pluginSearch, { target: { value: 'deck' } });
    expect(pluginSearch.value).toBe('deck');

    // Moving to the MCP submenu must clear the query so it doesn't cross-filter.
    fireEvent.click(screen.getByRole('menuitem', { name: /^MCP/i }));
    const mcpSearch = screen.getByPlaceholderText('MCP') as HTMLInputElement;
    expect(mcpSearch.value).toBe('');
    expect(screen.getByText('Linear')).toBeTruthy();
  });
});

describe('ComposerPlusMenu design toolbox flyout', () => {
  it('marks the toolbox flyout so CSS can keep it above and inside the viewport', () => {
    renderMenu({
      connectors: [],
      plugins: [],
      mcpServers: [],
      renderToolbox: () => (
        <div className="composer-design-toolbox-menu">
          <span>Toolbox content</span>
        </div>
      ),
      toolboxLabel: 'Design toolbox',
    });
    fireEvent.click(screen.getByTestId('plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Design toolbox/i }));

    const flyout = screen.getByText('Toolbox content').closest('.plus-menu__flyout');
    expect(flyout).toBeTruthy();
    expect(flyout?.classList.contains('plus-menu__flyout--toolbox')).toBe(true);
  });

  it('caps the toolbox flyout height when it would cross the viewport top edge', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(
      this: HTMLElement,
    ) {
      if (this instanceof HTMLElement && this.classList.contains('plus-menu__flyout--toolbox')) {
        return {
          x: 20,
          y: -80,
          top: -80,
          right: 380,
          bottom: 260,
          left: 20,
          width: 360,
          height: 340,
          toJSON: () => undefined,
        };
      }
      return originalRect.call(this);
    });

    renderMenu({
      connectors: [],
      plugins: [],
      mcpServers: [],
      renderToolbox: () => (
        <div className="composer-design-toolbox-menu">
          <span>Toolbox content</span>
        </div>
      ),
      toolboxLabel: 'Design toolbox',
    });
    fireEvent.click(screen.getByTestId('plus-trigger'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Design toolbox/i }));

    const flyout = screen.getByText('Toolbox content').closest<HTMLElement>('.plus-menu__flyout');
    expect(flyout).toBeTruthy();
    expect(flyout?.style.getPropertyValue('--plus-menu-toolbox-max-height')).toBe('244px');
    expect(flyout?.style.getPropertyValue('--plus-menu-toolbox-content-max-height')).toBe('232px');
  });
});
