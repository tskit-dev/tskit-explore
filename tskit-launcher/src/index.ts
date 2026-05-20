import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { Widget } from '@lumino/widgets';
import { ILauncher } from '@jupyterlab/launcher';

/**
 * Configuration for content hash checking
 */
interface IContentConfig {
  contentHash: string;
  lastUpdated: string;
  version?: string;
}

/**
 * Custom Launcher Widget with Update Detection
 */
class CustomLauncher extends Widget implements ILauncher {
  private app: JupyterFrontEnd | null = null;
  private contentConfig: IContentConfig | null = null;
  private readonly STORAGE_KEY = 'tskit-launcher-content-hash';
  private readonly AUTO_RESET_KEY = 'tskit-launcher-auto-reset-content-hash';
  private readonly UI_STATE_VERSION_KEY = 'tskit-launcher-ui-state-version';
  private readonly UI_STATE_VERSION = 'pyodide-2026-0';
  private readonly CONFIG_URL = './content-config.json';

  constructor() {
    super();
    this.addClass('jp-Launcher');
    this.id = 'launcher';
    this.title.label = 'Welcome';
    this.title.iconClass = 'jp-LauncherIcon';

    this.createUI();
    this.checkForUpdates();
  }

  private createUI(): void {
    this.node.innerHTML = `
      <div class="jp-Launcher-body tskit-launcher">
        <div class="jp-Launcher-content">

          <div class="tskit-header">
            <img src="https://raw.githubusercontent.com/tskit-dev/administrative/refs/heads/main/logos/svg/tskit/Tskit_logo.eps.svg" alt="tskit logo" class="tskit-logo" />
            <h1>explore</h1>
            <p>Interactive tree sequence notebooks</p>
          </div>

          <div class="tskit-update-warning" id="update-warning" style="display: none;">
            <div class="tskit-warning-content">
              <div class="tskit-warning-icon">⚠️</div>
              <div class="tskit-warning-text">
                <strong>Notebooks Updated!</strong>
                <p>You can update to them, but it will overwrite any local changes you have made.</p>
              </div>
              <button class="tskit-reset-button" id="reset-button">
                Reset Notebooks and Data
              </button>
            </div>
          </div>

          <div class="jp-Launcher-section">
            <div class="jp-Launcher-sectionHeader">
              <h2>Example notebooks</h2>
            </div>
            <div class="jp-Launcher-cardContainer">
              <div class="jp-LauncherCard tskit-card" id="tskit-notebook">
                <div class="jp-LauncherCard-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="#204e66"/>
                  </svg>
                </div>
                <div class="tskit-card-content">
                  <div class="jp-LauncherCard-label">Open tskit Tutorial</div>
                  <div class="jp-LauncherCard-description">Explore tree sequence analysis</div>
                </div>
              </div>
            </div>
            <div class="jp-Launcher-cardContainer">
              <div class="jp-LauncherCard tskit-card" id="sc2ts-notebook">
                <div class="jp-LauncherCard-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="#204e66"/>
                  </svg>
                </div>
                <div class="tskit-card-content">
                  <div class="jp-LauncherCard-label">Open sc2ts examples</div>
                  <div class="jp-LauncherCard-description">Explore the sc2ts dataset</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    `;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const tskitNotebookCard = this.node.querySelector('#tskit-notebook');
    if (tskitNotebookCard) {
      tskitNotebookCard.addEventListener('click', () => {
        this.app?.commands.execute('docmanager:open', {
          path: 'tskit.ipynb'
        });
      });
    }
    const sc2tsNotebookCard = this.node.querySelector('#sc2ts-notebook');
    if (sc2tsNotebookCard) {
      sc2tsNotebookCard.addEventListener('click', () => {
        this.app?.commands.execute('docmanager:open', {
          path: 'sc2ts.ipynb'
        });
      });
    }

    const resetButton = this.node.querySelector('#reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', async () => {
        await this.resetLocalState();
      });
    }
  }

  private async checkForUpdates(): Promise<void> {
    try {
      // Fetch current content configuration
      const response = await fetch(this.CONFIG_URL);
      if (!response.ok) {
        console.warn('Could not fetch content configuration');
        return;
      }

      this.contentConfig = await response.json();

      if (this.shouldResetUiStateForVersion()) {
        await this.resetUiState(this.UI_STATE_VERSION);
        return;
      }

      // Get stored hash from localStorage
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      const storedConfig = storedData ? JSON.parse(storedData) : null;

      // Check if content has been updated
      if (
        this.contentConfig &&
        storedConfig &&
        storedConfig.contentHash !== this.contentConfig.contentHash
      ) {
        if (this.shouldAutoResetUiState(this.contentConfig.contentHash)) {
          await this.resetUiState(this.contentConfig.contentHash);
          return;
        }

        this.showUpdateWarning();
      } else if (!storedConfig) {
        // First time visit - store the current hash
        this.storeCurrentHash();
      }
    } catch (error) {
      console.warn('Error checking for content updates:', error);
    }
  }

  private shouldResetUiStateForVersion(): boolean {
    return (
      localStorage.getItem(this.UI_STATE_VERSION_KEY) !== this.UI_STATE_VERSION
    );
  }

  private shouldAutoResetUiState(resetMarker: string): boolean {
    return sessionStorage.getItem(this.AUTO_RESET_KEY) !== resetMarker;
  }

  private showUpdateWarning(): void {
    const warningElement = this.node.querySelector(
      '#update-warning'
    ) as HTMLElement;
    if (warningElement) {
      warningElement.style.display = 'block';
    }
  }

  private storeCurrentHash(): void {
    if (this.contentConfig) {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.contentConfig)
      );
    }
  }

  private async resetUiState(resetMarker: string): Promise<void> {
    if (!this.contentConfig) {
      return;
    }

    sessionStorage.setItem(this.AUTO_RESET_KEY, resetMarker);

    this.clearJupyterLiteLocalStorage();
    await this.deleteIndexedDBDatabases(['JupyterLite Storage']);
    this.storeCurrentHash();
    localStorage.setItem(this.UI_STATE_VERSION_KEY, this.UI_STATE_VERSION);
    window.location.reload();
  }

  private async resetLocalState(): Promise<void> {
    try {
      // Clear JupyterLite state
      await this.clearJupyterLiteState();

      // Update stored hash
      this.storeCurrentHash();

      // Force refresh
      window.location.reload();
    } catch (error) {
      console.error('Error resetting local state:', error);
      // Fallback: just reload
      window.location.reload();
    }
  }

  private async clearJupyterLiteState(): Promise<void> {
    this.clearJupyterLiteLocalStorage();
    await this.clearJupyterLiteIndexedDBDatabases();
    await this.clearJupyterLiteCaches();
    await this.unregisterJupyterLiteServiceWorkers();
  }

  private clearJupyterLiteLocalStorage(): void {
    // Clear JupyterLite-specific localStorage items
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('jupyter-') ||
          key.startsWith('jupyterlab-') ||
          key.startsWith('lumino-') ||
          key.startsWith('@jupyterlab/') ||
          key.startsWith('@jupyterlite/') ||
          key.includes('filebrowser') ||
          key.includes('notebook') ||
          key.includes('kernel') ||
          key.includes('workspace'))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private async clearJupyterLiteIndexedDBDatabases(): Promise<void> {
    const knownDbNames = [
      'JupyterLite Storage',
      'JupyterLite Contents',
      'jupyter-config-data',
      'jupyter-lab-workspaces',
      'pyodide-packages'
    ];

    const dbNames = new Set(knownDbNames);
    const indexedDBWithDatabases = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };

    if (indexedDBWithDatabases.databases) {
      const databases = await indexedDBWithDatabases.databases();
      for (const database of databases) {
        const name = database.name;
        if (name && this.isJupyterLiteDatabase(name)) {
          dbNames.add(name);
        }
      }
    }

    await this.deleteIndexedDBDatabases([...dbNames]);
  }

  private isJupyterLiteDatabase(name: string): boolean {
    return (
      name.startsWith('JupyterLite') ||
      name.startsWith('jupyter') ||
      name.startsWith('pyodide')
    );
  }

  private async deleteIndexedDBDatabases(dbNames: string[]): Promise<void> {
    await Promise.all(
      dbNames.map(
        dbName =>
          new Promise<void>(resolve => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => {
              console.warn(`Could not delete database: ${dbName}`);
              resolve();
            };
            deleteRequest.onblocked = () => {
              console.warn(`Database deletion blocked: ${dbName}`);
              resolve();
            };
          })
      )
    );
  }

  private async clearJupyterLiteCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(
          cacheName => cacheName.includes('jupyter') || cacheName === 'precache'
        )
        .map(cacheName => caches.delete(cacheName))
    );
  }

  private async unregisterJupyterLiteServiceWorkers(): Promise<void> {
    if (!navigator.serviceWorker) {
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter(registration =>
          registration.active?.scriptURL.includes(location.origin)
        )
        .map(registration => registration.unregister())
    );
  }

  setApp(app: JupyterFrontEnd): void {
    this.app = app;
  }

  // Implement ILauncher interface methods
  add(options: any): any {
    return { dispose: () => {} };
  }
}

/**
 * The launcher plugin.
 */
const launcher: JupyterFrontEndPlugin<ILauncher> = {
  id: 'tskit_launcher:plugin',
  description: 'Tskit custom launcher',
  provides: ILauncher,
  requires: [],
  optional: [ILayoutRestorer],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer | null
  ): ILauncher => {
    const { shell } = app;

    const launcher = new CustomLauncher();
    launcher.setApp(app);

    shell.add(launcher, 'main');

    if (restorer) {
      restorer.add(launcher, 'launcher');
    }

    return launcher;
  },
  autoStart: true
};

export default launcher;
