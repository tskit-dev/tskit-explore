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
interface ContentConfig {
  contentHash: string;
  lastUpdated: string;
  version?: string;
}

/**
 * Custom Launcher Widget with Update Detection
 */
class CustomLauncher extends Widget implements ILauncher {
  private app: JupyterFrontEnd | null = null;
  private contentConfig: ContentConfig | null = null;
  private readonly STORAGE_KEY = 'tskit-launcher-content-hash';
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
              <h2>Section heading</h2>
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
          </div>
        </div>
      </div>

    `;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const notebookCard = this.node.querySelector('#tskit-notebook');
    if (notebookCard) {
      notebookCard.addEventListener('click', () => {
        this.app?.commands.execute('docmanager:open', {
          path: 'tskit.ipynb'
        });
      });
    }

    const resetButton = this.node.querySelector('#reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetLocalState();
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
      
      // Get stored hash from localStorage
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      const storedConfig = storedData ? JSON.parse(storedData) : null;

      // Check if content has been updated
      if (this.contentConfig && storedConfig && storedConfig.contentHash !== this.contentConfig.contentHash) {
        this.showUpdateWarning();
      } else if (!storedConfig) {
        // First time visit - store the current hash
        this.storeCurrentHash();
      }
    } catch (error) {
      console.warn('Error checking for content updates:', error);
    }
  }

  private showUpdateWarning(): void {
    const warningElement = this.node.querySelector('#update-warning') as HTMLElement;
    if (warningElement) {
      warningElement.style.display = 'block';
    }
  }

  private storeCurrentHash(): void {
    if (this.contentConfig) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.contentConfig));
    }
  }

  private resetLocalState(): void {
    try {
      // Clear JupyterLite state
      this.clearJupyterLiteState();
      
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

  private clearJupyterLiteState(): void {
    // Clear JupyterLite-specific localStorage items
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('jupyter-') || 
        key.startsWith('jupyterlab-') ||
        key.startsWith('lumino-') ||
        key.includes('notebook') ||
        key.includes('kernel')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear IndexedDB databases used by JupyterLite
    this.clearIndexedDBDatabases();
  }

  private clearIndexedDBDatabases(): void {
    // Common JupyterLite IndexedDB database names
    const dbNames = [
      'JupyterLite Storage',
      'jupyter-config-data',
      'jupyter-lab-workspaces',
      'pyodide-packages'
    ];

    dbNames.forEach(dbName => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onerror = () => {
        console.warn(`Could not delete database: ${dbName}`);
      };
    });
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