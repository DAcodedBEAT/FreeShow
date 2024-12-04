import { get } from "svelte/store"
import {
    activeEdit,
    activePopup,
    contextActive,
    customMessageCredits,
    lockedOverlays,
    outLocked,
    outputCache,
    outputSlideCache,
    outputs,
    overlays,
    playingAudio,
    playingMetronome,
    selected,
    slideTimers,
    topContextActive,
    videosData,
    videosTime,
} from "../../stores"
import { customActionActivation } from "../actions/actions"
import { clone } from "../helpers/array"
import { clearAudio } from "../helpers/audio"
import { clearPlayingVideo, getActiveOutputs, isOutCleared, setOutput } from "../helpers/output"
import { _show } from "../helpers/shows"
import { stopSlideRecording } from "../helpers/slideRecording"

export function clearAll(button = false) {
    if (get(outLocked)) return
    if (!button && (get(activePopup) || get(selected).id || get(activeEdit).items.length || get(contextActive) || get(topContextActive))) return

    // reset slide cache on Escape
    outputSlideCache.set({})

    const audioCleared = !Object.keys(get(playingAudio)).length && !get(playingMetronome)
    const allCleared = isOutCleared(null) && audioCleared
    if (allCleared) return

    storeCache()

    clearBackground()
    clearSlide(true)
    clearOverlays()
    clearAudio()
    clearTimers()
}

function storeCache() {
    if (!get(outputCache)) outputCache.set({})

    const activeOutputs = getActiveOutputs()

    outputCache.update((a) => {
        // only store active outputs
        activeOutputs.forEach((id) => {
            const out = get(outputs)[id]?.out
            if (out) a[id] = clone(out)
        })
        return a
    })
}

export function restoreOutput() {
    if (get(outLocked) || !get(outputCache)) return

    const activeOutputs = getActiveOutputs()

    outputs.update((a) => {
        Object.keys(get(outputCache)).forEach((id) => {
            // restore only selected outputs
            if (!activeOutputs.includes(id) || !a[id]) return
            a[id].out = get(outputCache)[id]
        })

        return a
    })

    outputCache.set(null)
}

export function clearBackground(outputId = "") {
    const outputIds: string[] = outputId ? [outputId] : getActiveOutputs()

    outputIds.forEach((outputId) => {
        // clearVideo()
        setOutput("background", null, false, outputId)
        clearPlayingVideo(outputId)

        // WIP this does not clear time properly
        videosData.update((a) => {
            delete a[outputId]
            return a
        })
        videosTime.update((a) => {
            delete a[outputId]
            return a
        })
    })

    customMessageCredits.set("") // unsplash
    customActionActivation("background_cleared")
}

export function clearSlide(clearAll = false) {
    if (!clearAll) {
        // store position
        const slideCache: any = {}
        const outputIds: string[] = getActiveOutputs()
        outputIds.forEach((outputId) => {
            const slide: any = get(outputs)[outputId]?.out?.slide || {}
            if (!slide.id) return

            // only store if not last slide
            const layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
            if (slide.index >= layoutRef.length - 1) return

            slideCache[outputId] = slide
        })
        if (Object.keys(slideCache).length) {
            outputSlideCache.set(clone(slideCache))
        }
        // slide gets outlined if not blurred
        ;(document.activeElement as any)?.blur()
    }

    setOutput("slide", null)
    stopSlideRecording()
    customActionActivation("slide_cleared")
}

export function clearOverlays(outputId = "") {
    const outputIds: string[] = outputId ? [outputId] : getActiveOutputs()

    outputIds.forEach((outputId) => {
        let outOverlays: string[] = get(outputs)[outputId]?.out?.overlays || []
        outOverlays = outOverlays.filter((id) => get(overlays)[id]?.locked)
        setOutput("overlays", outOverlays, false, outputId)
    })

    lockedOverlays.set([])
}

export function clearTimers(outputId = "") {
    setOutput("transition", null, false, outputId)

    const outputIds: string[] = outputId ? [outputId] : getActiveOutputs()
    Object.keys(get(slideTimers)).forEach((id) => {
        if (outputIds.includes(id)) get(slideTimers)[id].timer?.clear()
    })
}
