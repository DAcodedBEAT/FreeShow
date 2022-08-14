import { get } from "svelte/store"
import { STORE } from "../../types/Channels"
import {
  activeProject,
  alertUpdates,
  audioFolders,
  autoOutput,
  categories,
  defaultProjectName,
  drawer,
  drawerTabsData,
  drawSettings,
  events,
  exportPath,
  folders,
  formatNewShow,
  fullColors,
  groupNumbers,
  groups,
  imageExtensions,
  labelsDisabled,
  language,
  maxConnections,
  media,
  mediaCache,
  mediaFolders,
  mediaOptions,
  openedFolders,
  os,
  outLocked,
  outputs,
  overlayCategories,
  overlays,
  playerVideos,
  ports,
  presenterControllerKeys,
  projects,
  remotePassword,
  resized,
  saved,
  scriptures,
  scripturesCache,
  scriptureSettings,
  shows,
  showsCache,
  showsPath,
  slidesOptions,
  splitLines,
  stageShows,
  templateCategories,
  templates,
  textCache,
  theme,
  themes,
  transitionData,
  videoExtensions,
  volume,
  webFavorites,
} from "../stores"
import type { SaveListSettings } from "./../../types/Save"

export function save() {
  console.log("SAVING...")

  let settings: { [key in SaveListSettings]: any } = {
    initialized: true,
    activeProject: get(activeProject),
    alertUpdates: get(alertUpdates),
    audioFolders: get(audioFolders),
    autoOutput: get(autoOutput),
    maxConnections: get(maxConnections),
    ports: get(ports),
    categories: get(categories),
    defaultProjectName: get(defaultProjectName),
    // events: get(events),
    showsPath: get(showsPath),
    exportPath: get(exportPath),
    drawer: get(drawer),
    drawerTabsData: get(drawerTabsData),
    drawSettings: get(drawSettings),
    groupNumbers: get(groupNumbers),
    fullColors: get(fullColors),
    formatNewShow: get(formatNewShow),
    groups: get(groups),
    imageExtensions: get(imageExtensions),
    labelsDisabled: get(labelsDisabled),
    language: get(language),
    mediaFolders: get(mediaFolders),
    mediaOptions: get(mediaOptions),
    openedFolders: get(openedFolders),
    os: get(os),
    outLocked: get(outLocked),
    outputs: get(outputs),
    overlayCategories: get(overlayCategories),
    presenterControllerKeys: get(presenterControllerKeys),
    playerVideos: get(playerVideos),
    remotePassword: get(remotePassword),
    resized: get(resized),
    scriptures: get(scriptures),
    scriptureSettings: get(scriptureSettings),
    slidesOptions: get(slidesOptions),
    splitLines: get(splitLines),
    templateCategories: get(templateCategories),
    // templates: get(templates),
    theme: get(theme),
    transitionData: get(transitionData),
    // themes: get(themes),
    videoExtensions: get(videoExtensions),
    webFavorites: get(webFavorites),
    volume: get(volume),
  }
  // save settings & shows
  // , shows: get(shows)

  window.api.send(STORE, {
    channel: "SAVE",
    data: {
      // SETTINGS
      SETTINGS: settings,
      // CACHES (SAVED TO MULTIPLE FILES)
      showsCache: get(showsCache),
      scripturesCache: get(scripturesCache),
      // STORES
      SHOWS: get(shows),
      STAGE_SHOWS: get(stageShows),
      PROJECTS: { projects: get(projects), folders: get(folders) },
      OVERLAYS: get(overlays),
      TEMPLATES: get(templates),
      EVENTS: get(events),
      MEDIA: get(media),
      THEMES: get(themes),
      CACHE: { media: get(mediaCache), text: get(textCache) },
    },
  })

  saved.set(true)
}
