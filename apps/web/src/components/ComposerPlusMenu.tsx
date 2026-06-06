import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type {
  ConnectorDetail,
  InstalledPluginRecord,
  McpServerConfig,
} from '@open-design/contracts';
import { useT } from '../i18n';
import { Icon, type IconName } from './Icon';

export interface ComposerPlusMenuProps {
  /** Connector context options shown under the "Connectors" submenu. */
  connectors: ConnectorDetail[];
  onPickConnector: (connector: ConnectorDetail) => void;
  /** Opens the connector integration surface; omit to hide the add row. */
  onAddConnector?: () => void;

  /** Installed plugin options shown under the "Plugins" submenu. */
  plugins: InstalledPluginRecord[];
  onPickPlugin: (plugin: InstalledPluginRecord) => void;
  /** Opens the plugin registry; omit to hide the add row. */
  onAddPlugin?: () => void;

  /** Enabled MCP servers shown under the "MCP" submenu. */
  mcpServers: McpServerConfig[];
  onPickMcp: (server: McpServerConfig) => void;
  /** Opens MCP settings; omit to hide the add row. */
  onAddMcp?: () => void;

  /** Triggers file attachment (opens the native picker). */
  onAttachFiles: () => void;
  attachLoading?: boolean;

  /**
   * Optional "Design toolbox" row, rendered LAST. Only the project composer
   * passes this; the home composer omits it. The returned node is shown in a
   * right-side flyout reusing the same submenu styling.
   */
  renderToolbox?: (close: () => void) => ReactNode;
  toolboxLabel?: string;

  /** Test id for the trigger button. */
  triggerTestId?: string;

  /**
   * Notified when the menu opens. The project composer uses this to latch its
   * lazy plugin / MCP / connector fetches, so the Plugins / Connectors / MCP
   * submenus aren't empty when the "+" menu is the first thing clicked on a
   * cold composer.
   */
  onOpen?: () => void;
}

function pluginMatches(plugin: InstalledPluginRecord, needle: string): boolean {
  if (!needle) return true;
  return `${plugin.title} ${plugin.id}`.toLowerCase().includes(needle);
}

function mcpMatches(server: McpServerConfig, needle: string): boolean {
  if (!needle) return true;
  return `${server.label ?? ''} ${server.id}`.toLowerCase().includes(needle);
}

const TOOLBOX_FLYOUT_VIEWPORT_MARGIN = 16;
const TOOLBOX_FLYOUT_CHROME_HEIGHT = 12;

type ToolboxFlyoutStyle = CSSProperties & {
  '--plus-menu-toolbox-content-max-height'?: string;
  '--plus-menu-toolbox-max-height'?: string;
  '--plus-menu-toolbox-shift-y'?: string;
};

/**
 * The composer "+" menu shared between the home hero and the project chat
 * composer. Owns its own open / submenu / search state; callers supply the
 * data lists and pick/add handlers. Pass `renderToolbox` to append the
 * project-only design-toolbox row.
 */
export function ComposerPlusMenu({
  connectors,
  onPickConnector,
  onAddConnector,
  plugins,
  onPickPlugin,
  onAddPlugin,
  mcpServers,
  onPickMcp,
  onAddMcp,
  onAttachFiles,
  attachLoading,
  renderToolbox,
  toolboxLabel,
  triggerTestId,
  onOpen,
}: ComposerPlusMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<
    'connectors' | 'plugins' | 'mcp' | 'toolbox' | null
  >(null);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The plugin and MCP flyouts share one `query`, but it is scoped to whichever
  // submenu is open. Reset it whenever the active submenu changes so a stale
  // plugin search (e.g. "deck") never filters the MCP list — which would
  // otherwise show the empty state even when servers exist.
  useEffect(() => {
    setQuery('');
  }, [submenu]);

  function close() {
    setOpen(false);
    setSubmenu(null);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (submenu) {
        setSubmenu(null);
        return;
      }
      close();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, submenu]);

  const needle = query.trim().toLowerCase();
  const filteredPlugins = needle
    ? plugins.filter((p) => pluginMatches(p, needle))
    : plugins;
  const filteredMcp = needle
    ? mcpServers.filter((s) => mcpMatches(s, needle))
    : mcpServers;

  return (
    <div className="plus-menu" ref={rootRef}>
      <button
        type="button"
        className={`icon-btn plus-menu__trigger od-tooltip${open ? ' is-active' : ''}`}
        data-testid={triggerTestId}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          onOpen?.();
          setOpen(true);
        }}
        title={t('homeHero.addMenu')}
        data-tooltip={t('homeHero.addMenu')}
        aria-label={t('homeHero.addMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="plus" size={16} />
      </button>
      {open ? (
        <div className="plus-menu__popup" role="menu">
          <button
            type="button"
            role="menuitem"
            className="plus-menu__item"
            data-testid="composer-plus-attach"
            disabled={attachLoading}
            onClick={() => {
              close();
              onAttachFiles();
            }}
          >
            <Icon
              name={attachLoading ? 'spinner' : 'attach'}
              size={15}
              className="plus-menu__item-icon"
            />
            <span>{t('chat.attachAria')}</span>
          </button>
          <PlusSubmenuRow
            label={t('connectors.title')}
            icon="link"
            open={submenu === 'connectors'}
            onOpen={() => setSubmenu('connectors')}
            onClose={() => setSubmenu(null)}
          >
            <div className="plus-menu__list">
              {connectors.length === 0 ? (
                <div className="plus-menu__empty">{t('homeHero.noConnectors')}</div>
              ) : (
                connectors.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    role="menuitem"
                    className="plus-menu__item"
                    // Keep focus on the editor so the pick handler's
                    // insertMention lands at the caret, not the draft end.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close();
                      onPickConnector(connector);
                    }}
                  >
                    <Icon name="link" size={15} className="plus-menu__item-icon" />
                    <span>{connector.name}</span>
                  </button>
                ))
              )}
            </div>
            {onAddConnector ? (
              <>
                <div className="plus-menu__divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="plus-menu__item"
                  onClick={() => {
                    close();
                    onAddConnector();
                  }}
                >
                  <Icon name="plus" size={15} className="plus-menu__item-icon" />
                  <span>{t('homeHero.addConnectors')}</span>
                </button>
              </>
            ) : null}
          </PlusSubmenuRow>
          <PlusSubmenuRow
            label={t('entry.navPlugins')}
            icon="sparkles"
            open={submenu === 'plugins'}
            onOpen={() => setSubmenu('plugins')}
            onClose={() => setSubmenu(null)}
          >
            <div className="plus-menu__search">
              <Icon name="search" size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('entry.navPlugins')}
                aria-label={t('entry.navPlugins')}
              />
            </div>
            <div className="plus-menu__list">
              {filteredPlugins.length === 0 ? (
                <div className="plus-menu__empty">{t('homeHero.noPlugins')}</div>
              ) : (
                filteredPlugins.map((plugin) => (
                  <button
                    key={plugin.id}
                    type="button"
                    role="menuitem"
                    className="plus-menu__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close();
                      onPickPlugin(plugin);
                    }}
                  >
                    <Icon name="sparkles" size={15} className="plus-menu__item-icon" />
                    <span>{plugin.title}</span>
                  </button>
                ))
              )}
            </div>
            {onAddPlugin ? (
              <>
                <div className="plus-menu__divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="plus-menu__item"
                  onClick={() => {
                    close();
                    onAddPlugin();
                  }}
                >
                  <Icon name="plus" size={15} className="plus-menu__item-icon" />
                  <span>{t('homeHero.addPlugin')}</span>
                </button>
              </>
            ) : null}
          </PlusSubmenuRow>
          <PlusSubmenuRow
            label="MCP"
            icon="link"
            open={submenu === 'mcp'}
            onOpen={() => setSubmenu('mcp')}
            onClose={() => setSubmenu(null)}
          >
            <div className="plus-menu__search">
              <Icon name="search" size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="MCP"
                aria-label="MCP"
              />
            </div>
            <div className="plus-menu__list">
              {filteredMcp.length === 0 ? (
                <div className="plus-menu__empty">{t('homeHero.noMcp')}</div>
              ) : (
                filteredMcp.map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    role="menuitem"
                    className="plus-menu__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close();
                      onPickMcp(server);
                    }}
                  >
                    <Icon name="link" size={15} className="plus-menu__item-icon" />
                    <span>{server.label || server.id}</span>
                  </button>
                ))
              )}
            </div>
            {onAddMcp ? (
              <>
                <div className="plus-menu__divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="plus-menu__item"
                  onClick={() => {
                    close();
                    onAddMcp();
                  }}
                >
                  <Icon name="plus" size={15} className="plus-menu__item-icon" />
                  <span>{t('homeHero.addMcp')}</span>
                </button>
              </>
            ) : null}
          </PlusSubmenuRow>
          {renderToolbox ? (
            <PlusSubmenuRow
              label={toolboxLabel ?? t('chat.designToolbox.tooltip')}
              icon="lightbulb"
              open={submenu === 'toolbox'}
              onOpen={() => setSubmenu('toolbox')}
              onClose={() => setSubmenu(null)}
              flyoutVariant="toolbox"
            >
              {renderToolbox(close)}
            </PlusSubmenuRow>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlusSubmenuRow({
  label,
  icon,
  open,
  onOpen,
  onClose,
  children,
  flyoutVariant,
}: {
  label: string;
  icon: IconName;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
  flyoutVariant?: 'toolbox';
}) {
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [toolboxFlyoutStyle, setToolboxFlyoutStyle] = useState<ToolboxFlyoutStyle>();

  useLayoutEffect(() => {
    if (!open || flyoutVariant !== 'toolbox') {
      setToolboxFlyoutStyle(undefined);
      return;
    }
    const flyout = flyoutRef.current;
    if (!flyout || typeof window === 'undefined') return;

    let frame: number | null = null;
    const updateMetrics = () => {
      frame = null;
      const rect = flyout.getBoundingClientRect();
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const minTop = viewportTop + TOOLBOX_FLYOUT_VIEWPORT_MARGIN;
      const maxBottom = viewportTop + viewportHeight - TOOLBOX_FLYOUT_VIEWPORT_MARGIN;
      const shiftY = Math.min(0, maxBottom - rect.bottom);
      const clampedBottom = rect.bottom + shiftY;
      const maxHeight = Math.min(430, Math.max(0, Math.floor(clampedBottom - minTop)));
      const contentMaxHeight = Math.max(0, maxHeight - TOOLBOX_FLYOUT_CHROME_HEIGHT);
      const next: ToolboxFlyoutStyle = {
        '--plus-menu-toolbox-content-max-height': `${contentMaxHeight}px`,
        '--plus-menu-toolbox-max-height': `${maxHeight}px`,
        '--plus-menu-toolbox-shift-y': `${shiftY}px`,
      };
      setToolboxFlyoutStyle((prev) => {
        if (
          prev?.['--plus-menu-toolbox-content-max-height']
            === next['--plus-menu-toolbox-content-max-height']
          && prev?.['--plus-menu-toolbox-max-height'] === next['--plus-menu-toolbox-max-height']
          && prev?.['--plus-menu-toolbox-shift-y'] === next['--plus-menu-toolbox-shift-y']
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateMetrics);
    };

    updateMetrics();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleUpdate)
        : null;
    resizeObserver?.observe(flyout);
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, [flyoutVariant, open]);

  return (
    <div
      className="plus-menu__submenu-row"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        role="menuitem"
        className="plus-menu__item plus-menu__parent"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        <Icon name={icon} size={15} className="plus-menu__item-icon" />
        <span>{label}</span>
        <Icon name="chevron-right" size={13} className="plus-menu__chevron" />
      </button>
      {open ? (
        <div
          className={`plus-menu__flyout${flyoutVariant ? ` plus-menu__flyout--${flyoutVariant}` : ''}`}
          ref={flyoutRef}
          role="menu"
          style={flyoutVariant === 'toolbox' ? toolboxFlyoutStyle : undefined}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
