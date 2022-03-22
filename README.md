# secure-electron-context-menu

A secure way to implement a context menu in electron apps. Create custom (or electron-defined) context menus. This package was designed to work within [`secure-electron-template`](https://github.com/reZach/secure-electron-template).

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=reZach_secure-electron-context-menu&metric=alert_status)](https://sonarcloud.io/dashboard?id=reZach_secure-electron-context-menu)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=reZach_secure-electron-context-menu&metric=security_rating)](https://sonarcloud.io/dashboard?id=reZach_secure-electron-context-menu)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=reZach_secure-electron-context-menu&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=reZach_secure-electron-context-menu)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=reZach_secure-electron-context-menu&metric=bugs)](https://sonarcloud.io/dashboard?id=reZach_secure-electron-context-menu)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=reZach_secure-electron-context-menu&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=reZach_secure-electron-context-menu)

![Context menu](https://github.com/reZach/secure-electron-context-menu/blob/master/docs/contextmenu.png "Context menu")

## Getting started

### Install via npm

Run `npm i secure-electron-context-menu`

### Modify your main.js file

Modify the file that creates the [`BrowserWindow`](https://www.electronjs.org/docs/api/browser-window) like so:

```javascript
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  ...
} = require("electron");
const ContextMenu = require("secure-electron-context-menu").default;
const isDev = process.env.NODE_ENV === "development";

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

async function createWindow() {

  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
    //spellcheck: true, // Enables SpellChecker
      preload: path.join(__dirname, "preload.js") // a preload script is necessary!
    }
  });

  // Set SpellChecker language, no effect on macOS.
  // win.webContents.session.setSpellCheckerLanguages(["fr-FR"])

  // Sets up bindings for our custom context menu
  ContextMenu.mainBindings(ipcMain, win, Menu, isDev, {
    "alertTemplate": [{
      id: "alert",
      label: "AN ALERT!"
    }]
  });

  // Load app
  win.loadFile("path_to_my_html_file");
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  } else {
    ContextMenu.clearMainBindings(ipcMain);
  }
});
```

### Modify your preload.js file

Create/modify your existing preload file with the following additions:

```javascript
const { contextBridge, ipcRenderer } = require("electron")
const ContextMenu = require("secure-electron-context-menu").default

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
    contextMenu: ContextMenu.preloadBindings(ipcRenderer),
})
```

## Defining your custom context menu

This library is unique in that we don't just give you the ability to use one context menu for your app, you have the power to make/use any number of context menus. Say, for instance that you want a different context menu to show up when you right-click a particular &lt;div&gt; than an &lt;img&gt; tag, you can do that!

In the `.mainBindings` call, you define all possible context menus for your app as the last parameter to the function. Each key can hold a custom array of [menu items](https://www.electronjs.org/docs/api/menu-item). You can see an example below where we have a more traditional context menu (with [roles](https://www.electronjs.org/docs/api/menu-item#roles)) and two custom context menus:

```javascript
ContextMenu.mainBindings(ipcMain, win, Menu, isDev, {
    alertTemplate: [
        {
            id: "alert",
            label: "ALERT ME!",
        },
    ],
    logTemplate: [
        {
            id: "log",
            label: "Log me",
        },
        {
            type: "separator",
        },
        {
            id: "calculate",
            label: "Open calculator",
        },
    ],
    default: [
        {
            label: "Edit",
            submenu: [
                {
                    role: "undo",
                },
                {
                    role: "redo",
                },
                {
                    type: "separator",
                },
                {
                    role: "cut",
                },
                {
                    role: "copy",
                },
                {
                    role: "paste",
                },
            ],
        },
    ],
})
```

For any of the menu items that you'd like to take action on (in code), an **id property is required**. We'll see about more what that means in the next section.

## Setting up an element to trigger the context menu

In order for your HTML elements to trigger a particular context menu, you need to add an `cm-template` attribute to it. For example:

```html
<div cm-template="alertTemplate"></div>
```

Now, whenever this div is right-clicked, the "alertTemplate" context menu is shown. Additionally, if the **isDev** value passed into `.mainBindings` is true, an **Inspect Element** option is added to the context menu.

## Passing custom values to the context menu

Showing a custom context menu is neat, but that isn't useful unless we can act on it somehow. Say, for example's sake, we want to allow the user to `alert()` a particular value from selecting an option from the context menu.

On any element that we have set an `cm-template` attribute, we can set any number of `cm-payload-` attributes to pass data we can act on when this context menu option is selected. An example:

```jsx
import React from "react"
import "./contextmenu.css"

class Component extends React.Component {
    constructor(props) {
        super(props)
    }

    componentWillUnmount() {
        // Clear any existing bindings;
        // important on mac-os if the app is suspended
        // and resumed. Existing subscriptions must be cleared
        window.api.contextMenu.clearRendererBindings()
    }

    componentDidMount() {
        // Set up binding in code whenever the context menu item
        // of id "alert" is selected
        window.api.contextMenu.onReceive("alert", function (args) {
            // We have access to the cm-payload-name value through:
            // args.attributes.name
            alert(args.attributes.name) // Alerts "abc"

            // An example showing you can pass more than one value
            console.log(args.attributes.name2) // Prints "def" in the console

            // Note - we have access to the "params" object as defined here: https://www.electronjs.org/docs/api/web-contents#event-context-menu
            // args.params
        })
    }

    render() {
        return (
            <div id="contextmenu">
                <h1>Context menu</h1>
                <div cm-template="alertTemplate" cm-payload-name="abc" cm-payload-name2="def">
                    Try right-clicking me for a custom context menu
                </div>
            </div>
        )
    }
}

export default Component
```

What is needed is to create bindings in code using `window.api.contextMenu.onReceive` (as seen above) for each of the context menu items that you want to use in code. You can see that we have access to the attributes defined on the HTML.

> This library works with plain JS too, and not just React!

It is also important to use the `clearRendererBindings` function as seen above, this is important on MacOS.

## Context menus for items in a collection

If you are creating context menus for items in a collection, you need to add an `cm-id` attribute on your element _and_ on the `.onReceive` listener, otherwise - the element you initiated the context menu with (ie., by right-clicking) may not be the element that receives the event!

> It does not matter what the value of `cm-id`/onReceive event is, so long as it is unique between all elements that use the same template!

Assuming `Sample` is a component that you would render a collection of; instead of this:

```jsx
import React from "react"

class Sample extends React.Component {
    constructor() {
        super()

        this.state = {
            name: "reZach",
        }

        this.changeName = this.changeName.bind(this)
    }

    componentWillUnmount() {
        window.api.contextMenu.clearRendererBindings()
    }

    componentDidMount() {
        window.api.contextMenu.onReceive(
            "log",
            function (args) {
                console.log(args.attributes.name)
            }.bind(this)
        )
    }

    changeName() {
        const names = ["Bob", "Jill", "Jane"]
        let newIndex = Math.floor(Math.random() * 3)
        this.setState((state) => ({
            name: names[newIndex],
        }))
    }

    render() {
        return (
            <div>
                <input type="button" onClick={this.changeName} value="Random name"></input>
                <div cm-template="logTemplate" cm-payload-name={this.state.name}>
                    Right-click me for a custom context menu
                </div>
            </div>
        )
    }
}
```

Do this:

```jsx
import React from "react";

class Sample extends React.Component {
  constructor() {
    super();

    this.state = {
      name: "reZach"
    };

    this.uniqueId = "Sample 1"; // In production apps, you'd make this unique per Sample (ie. use a Sample's id or a GUID)

    this.changeName = this.changeName.bind(this);
  }

  componentWillUnmount() {
    window.api.contextMenu.clearRendererBindings();
  }

  componentDidMount() {
    window.api.contextMenu.onReceive(
      "log",
      function(args) {
        console.log(args.attributes.name);
      }.bind(this),
      this.uniqueId /* added! */
    );
  }

  changeName() {
    const names = ["Bob", "Jill", "Jane"];
    let newIndex = Math.floor(Math.random() * 3);
    this.setState((state) => ({
      name: names[newIndex]
    }));
  }

  render() {
    return (
      <div>
        <input
          type="button"
          onClick={this.changeName}
          value="Random name"></input>
        <div
          cm-template="logTemplate"
          cm-id={this.uniqueId} {/* added! */}
          cm-payload-name={this.state.name}>
          Right-click me for a custom context menu
        </div>
      </div>
    );
  }
}

```

## Svelte example

```html
<script>
    import { onMount, onDestroy } from "svelte"

    let newUser = {
        firstname: "",
        lastname: "",
    }
    let users = [
        {
            id: "1",
            name: "John Doe",
        },
    ]

    function addUser() {
        const user = {
            id: users.length + 1,
            firstname: newUser.firstname,
            lastname: newUser.lastname,
        }
        users.push(user)
        users = users
        newUser = {
            firstname: "",
            lastname: "",
        }
    }

    onMount(() => {
        window.api.contextMenu.onReceive("log", (args) => {
            const foundUser = users.find((x) => x.id == args.attributes.id)
            console.log(foundUser)
        })
    })
    onDestroy(() => {
        window.api.contextMenu.clearRendererBindings()
    })
</script>

<div>
    <input placeholder="firstname" bind:value="{newUser.firstname}" />
    <input placeholder="lastname" bind:value="{newUser.lastname}" />
    <button on:click="{addUser}">Add</button>
</div>

{#each users as user}
<div cm-template="logTemplate" cm-id="{user.id}">{user.firstname} - Right-click me for a custom context menu</div>
{/each}
```
