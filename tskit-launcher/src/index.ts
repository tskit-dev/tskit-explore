import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { Widget } from '@lumino/widgets';

import { ILauncher } from '@jupyterlab/launcher';


/**
 * Custom Launcher Widget
 */
class CustomLauncher extends Widget implements ILauncher {
  constructor() {
    super();
    this.addClass('jp-Launcher');
    this.id = 'launcher';
    this.title.label = 'Welcome';
    this.title.iconClass = 'jp-LauncherIcon';

    // Create your custom launcher UI
    this.node.innerHTML = `
      <div class="jp-Launcher-body tskit-launcher">
        <div class="jp-Launcher-content">
          <div class="tskit-header">
            <img src="https://raw.githubusercontent.com/tskit-dev/administrative/refs/heads/main/logos/svg/tskit/Tskit_logo.eps.svg" alt="tskit logo" class="tskit-logo" />
            <h1>explore</h1>
            <p>Interactive tree sequence notebooks</p>
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
                  <div class="jp-LauncherCard-description">Explore tree sequence analysis with interactive examples</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add click handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const notebookCard = this.node.querySelector('#tskit-notebook');
    if (notebookCard) {
      notebookCard.addEventListener('click', () => {
        // Open the existing tskit.ipynb notebook
        this.app?.commands.execute('docmanager:open', {
          path: 'tskit.ipynb'
        });
      });
    }
  }

  // Store reference to app for command execution
  private app: JupyterFrontEnd | null = null;

  setApp(app: JupyterFrontEnd): void {
    this.app = app;
  }

  // Implement ILauncher interface methods
  add(options: any): any {
    // Implement if you want to support dynamic launcher items
    // For a hardcoded launcher, this can be minimal
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

    // Create the custom launcher widget
    const launcher = new CustomLauncher();
    launcher.setApp(app);

    // Add the launcher to the shell initially
    shell.add(launcher, 'main');

    // Track the launcher for state restoration
    if (restorer) {
      restorer.add(launcher, 'launcher');
    }

    return launcher;
  },
  autoStart: true
};

export default launcher;