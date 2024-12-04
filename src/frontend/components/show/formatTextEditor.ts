import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Item, Line, Show, Slide, SlideData } from "../../../types/Show"
import { activeShow } from "../../stores"
import { createChord } from "../edit/scripts/chords"
import { getItemChords, getItemText, getSlideText } from "../edit/scripts/textStyle"
import { clone, keysToID, removeDuplicates } from "../helpers/array"
import { history } from "../helpers/history"
import { isEmptyOrSpecial } from "../helpers/output"
import { getGlobalGroup } from "../helpers/show"
import { _show } from "../helpers/shows"

export function formatText(text: string, showId = "") {
    if (!showId) showId = get(activeShow)?.id || ""
    const show: Show = clone(_show(showId).get())
    if (!show) return

    const newSlidesText = text.split("\n\n")

    const slides: Slide[] = newSlidesText.map(getSlide)
    let newSlides: { [key: string]: Slide } = clone(show.slides)
    // console.log(clone(slides))

    // sort oldSlides by their children
    const oldSlideParents: Slide[] = keysToID(show.slides).filter((a) => a.group)
    const oldSlides: Slide[] = []
    oldSlideParents.forEach((slide) => {
        oldSlides.push(slide)
        if (slide.children) {
            // add "missing" text content to parent slide with children text content
            if (!getSlideText(oldSlides[oldSlides.length - 1]).length && slide.children.find((id) => getSlideText(show.slides[id]))) {
                oldSlides[oldSlides.length - 1].items.push({
                    ...clone(defaultItem),
                    lines: [getLine(" ", [])],
                })
                newSlides[slide.id!] = clone(oldSlides[oldSlides.length - 1])
            }

            slide.children.forEach((childId) => {
                oldSlides.push(show.slides[childId])
            })
        }
    })

    const groupedOldSlides = groupSlides(oldSlides)
    const groupedNewSlides = groupSlides(slides)
    // console.log(groupedOldSlides, groupedNewSlides)

    // TODO: renaming existing groups!

    const newLayoutSlides: SlideData[] = []

    const doneGroupedSlides: any[] = []
    groupedNewSlides.forEach(({ text, slides }: any) => {
        let matchFound = false

        // check matching from existing slides (both old and new)
        ;[...groupedOldSlides, ...doneGroupedSlides].forEach((old: any) => {
            if (matchFound) return
            if (old.text !== text) return

            matchFound = true

            const id = old.slides[0].id
            newLayoutSlides.push({ id })

            // set changed children
            if (old.slides.length !== slides.length) {
                newSlides[id] = slides.shift()

                if (slides.length) {
                    // children
                    const children: string[] = []
                    slides.forEach((slide) => {
                        const childId = uid()
                        children.push(childId)
                        newSlides[childId] = slide
                    })

                    newSlides[id].children = children
                }
            }
        })

        if (matchFound) return
        doneGroupedSlides.push({ text, slides })

        const children: string[] = []
        slides.forEach((_slide, i) => {
            if (i > 0) {
                slides[i].id = uid()
                children.push(slides[i].id)
            }
        })
        slides[0].id = uid()
        if (children.length) slides[0].children = children

        slides.forEach((slide) => {
            newSlides[slide.id] = slide
        })

        newLayoutSlides.push({ id: slides[0].id })
    })

    const oldLayoutSlides = show.layouts[_show(showId).get("settings.activeLayout")].slides
    const oldLayoutSlideIds: string[] = oldLayoutSlides.map(({ id }) => id)

    // add back all slides without text
    const newLayoutSlideIds: string[] = newLayoutSlides.map(({ id }) => id)
    oldLayoutSlideIds.forEach((slideId) => {
        if (newLayoutSlideIds.includes(slideId)) return
        const slide = show.slides[slideId]
        if (!slide) return

        const textboxes = getTextboxesIndexes(slide.items)
        if (textboxes.length) return

        newLayoutSlides.push({ id: slideId })
    })

    // add back layout data
    const replacedIds: any = {}
    newLayoutSlides.forEach(({ id }, i) => {
        if (!oldLayoutSlides.length) return

        const matchingLayoutIndex = oldLayoutSlides.findIndex((a) => a.id === id)
        if (matchingLayoutIndex < 0) {
            const idCommingUp = newLayoutSlides.find((a, index) => index > i && a.id === id)
            if (idCommingUp) return

            const oldLayoutSlide = oldLayoutSlides[0]
            const oldSlideChildren: string[] = show.slides[oldLayoutSlide.id]?.children || []

            // find children data
            if (oldLayoutSlide.children) {
                const newChildrenData: any = {}
                oldSlideChildren.forEach((oldChildId, i) => {
                    const newChildId = newSlides[id].children?.[i]
                    if (!newChildId) return

                    replacedIds[newChildId] = oldChildId
                    newChildrenData[newChildId] = oldLayoutSlide.children[oldChildId]
                })
                oldLayoutSlide.children = newChildrenData
            }

            replacedIds[id] = oldLayoutSlide.id
            newLayoutSlides[i] = { ...oldLayoutSlide, id }
            oldLayoutSlides.splice(0, 1)
            return
        }

        const oldLayoutSlide = oldLayoutSlides[matchingLayoutIndex]
        replacedIds[id] = oldLayoutSlide.id
        newLayoutSlides[i] = oldLayoutSlide
        oldLayoutSlides.splice(0, matchingLayoutIndex + 1)
    })

    show.layouts[_show(showId).get("settings.activeLayout")].slides = newLayoutSlides

    // remove replaced slides
    const allOldSlideIds = Object.keys(show.slides)

    let allUsedSlidesIds: string[] = []
    Object.values(show.layouts).forEach(({ slides }) => {
        allUsedSlidesIds.push(...slides.map(({ id }) => id))
    })
    allUsedSlidesIds = removeDuplicates(allUsedSlidesIds)

    // remove unused slides that was previously used by current layout
    allOldSlideIds.forEach((slideId) => {
        if (oldLayoutSlideIds.includes(slideId) && !allUsedSlidesIds.includes(slideId)) {
            // delete children
            const children = newSlides[slideId].children || []
            children.forEach((childId) => {
                delete newSlides[childId]
            })

            delete newSlides[slideId]
        }
    })

    Object.keys(newSlides).forEach((slideId) => {
        const slide = newSlides[slideId]
        const oldSlideId = replacedIds[slideId] || slideId

        // add back previous textbox styles
        const oldSlide = clone(show.slides[oldSlideId] || {})
        const oldTextboxes = getTextboxes(oldSlide.items || [])
        if (oldTextboxes.length && oldSlideId !== slideId) {
            slide.items.forEach((a, i) => {
                const b = oldTextboxes[i]
                if (b.style) a.style = b.style
                ;(a.lines || []).forEach((line, j) => {
                    const c = b.lines?.[j] || b.lines?.[0]
                    if (c?.align) line.align = c?.align

                    // remove customType
                    const text = (c?.text || []).filter((a) => !a.customType)
                    if (text[0] && line.text?.[0]) {
                        if (text[0].style) line.text[0].style = text[0]?.style
                    }
                })

                // add auto size etc.
                const textboxKeys = ["auto", "actions", "autoFontSize", "bindings", "chords", "textFit"]
                textboxKeys.forEach((key) => {
                    if (b[key]) a[key] = b[key]
                })
            })
            // newSlides[slideId].items = slide.items
        }

        // remove "id" key
        delete slide.id

        // add back old items
        const oldItems = show.slides[oldSlideId]?.items || []
        if (!oldItems.length) return

        let items: Item[] = clone(oldItems)
        const newItems: Item[] = slide.items
        if (newItems.length) {
            // let textboxItemIndex = getFirstNormalTextboxIndex(oldItems)
            const textboxItemIndexes = getTextboxesIndexes(oldItems)
            if (!textboxItemIndexes.length) {
                items = [...removeEmptyTextboxes(oldItems), ...newItems]
            } else {
                textboxItemIndexes
                    .sort((a, b) => b - a)
                    .forEach((index) => {
                        // set to default if text has been removed
                        items[index] = newItems.splice(index, 1)[0] || clone(defaultItem)
                    })

                // new items added
                if (newItems.length) {
                    items.push(...newItems)
                    // remove empty items
                    items = items.filter((item) => getItemText(item).length)
                }
            }
        }

        slide.items = items
        newSlides[slideId] = slide
    })

    // remove first slide if no content
    if (!text && Object.keys(newSlides).length === 1) {
        const textItem = Object.values(newSlides)[0].items.find((a) => (a.type || "text") === "text")
        if (textItem) {
            const fullOldSlideText = getItemText(textItem)
            if (!fullOldSlideText) {
                newSlides = {}
                show.layouts[_show(showId).get("settings.activeLayout")].slides = []
            }
        }
    }

    show.slides = newSlides
    // if (!show.settings.template) show.settings.template = "default"

    history({
        id: "UPDATE",
        newData: { data: show },
        oldData: { id: showId },
        location: { page: "show", id: "show_key" },
    })
}

function getSlide(slideText): Slide {
    const slideLines: string[] = slideText.split("\n")
    let group: any = null

    const firstLine = slideLines[0]
    const textboxKey = firstLine.match(textboxRegex)
    if (!textboxKey && firstLine.indexOf("[") === 0 && firstLine.indexOf("]") >= 0) {
        group = firstLine.slice(firstLine.indexOf("[") + 1, firstLine.indexOf("]"))
        slideLines.splice(0, 1)
    }

    const items: Item[] = linesToTextboxes(slideLines)
    const slide: Slide = { group, color: "", settings: {}, notes: "", items }

    if (group) {
        const globalGroup = getGlobalGroup(group)
        if (globalGroup) slide.globalGroup = globalGroup
    }

    return slide
}

export const defaultItem: Item = {
    type: "text",
    lines: [],
    style: "top:120px;left:50px;height:840px;width:1820px;",
}
const textboxRegex = /\[#(\d+)(?::([^\]]+))?\]/
export function linesToTextboxes(slideLines: string[]) {
    const items: Item[] = []
    let currentItemIndex = 0

    slideLines.forEach((line) => {
        const textboxKey = line.match(textboxRegex)
        if (textboxKey) {
            currentItemIndex = Number(textboxKey[1])
            const language = textboxKey[2]
            if (language) {
                if (!items[currentItemIndex]) items[currentItemIndex] = clone(defaultItem)
                items[currentItemIndex].language = language
            }

            // add content on current line
            line = line.slice(line.indexOf("]") + 1).trim()
            if (!line.length) return
        }

        if (!items[currentItemIndex]) items[currentItemIndex] = clone(defaultItem)

        const lineData = getChords(line)
        items[currentItemIndex].lines!.push(getLine(lineData.text, lineData.chords))
    })

    return items.filter(Boolean).reverse()
}

function getChords(line: string) {
    let text = ""
    const chords: Chords[] = []

    let currentlyInChord = false
    let currentChord = ""

    line.split("").forEach((char) => {
        if (char === "[") {
            currentlyInChord = true
            currentChord = ""
            return
        }

        if (!currentlyInChord) {
            text += char
            return
        }

        if (char === "]") {
            currentlyInChord = false
            if (currentChord.length > 12)
                text += `[${currentChord}]` // probably not a chord
            else chords.push(createChord(text.length, currentChord))
            return
        }

        currentChord += char
    })

    return { text, chords }
}

export function getLine(text: string, chords: Chords[]): Line {
    const line: Line = {
        align: "",
        text: [{ value: text, style: "font-size: 100px;" }],
    }
    if (chords.length) line.chords = chords
    return line
}

function groupSlides(slides: Slide[]) {
    const slideGroups: any[] = []
    let currentIndex = -1

    slides.forEach((slide, i) => {
        if (i === 0 && !slide.group) {
            slide.group = "Verse"
            slide.globalGroup = "verse"
        }
        if (slide.group) currentIndex++
        if (!slideGroups[currentIndex]) slideGroups[currentIndex] = { text: "", slides: [] }
        slideGroups[currentIndex].slides.push(slide)

        const textItems = getTextboxes(slide.items)
        if (!textItems.length) return

        const fullOldSlideText = textItems.reduce((value, item) => (value += getItemText(item) + getItemChords(item)), "")
        if (!fullOldSlideText) return

        // adding length so line breaks with no text changes works
        const linesLength = textItems.reduce((value, item) => (value += item.lines?.length || 0), 0)
        slideGroups[currentIndex].text += fullOldSlideText + linesLength
    })

    return slideGroups
}

export function getTextboxesIndexes(items: Item[]): number[] {
    const indexes: number[] = []

    items.forEach((item, i) => {
        if (!item?.lines) return

        const special = isEmptyOrSpecial(item)
        if (special) return

        indexes.push(i)
    })

    return indexes
}

function removeEmptyTextboxes(items: Item[]) {
    return items.filter((item) => {
        if ((item.type || "text") !== "text") return true
        return getItemText(item).length
    })
}

export function getTextboxes(items: Item[]) {
    const indexes = getTextboxesIndexes(items)
    return items.filter((_item, i) => indexes.includes(i))
}
