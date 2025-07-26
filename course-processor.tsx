"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, FileSpreadsheet, FolderOpen, Upload, HelpCircle } from "lucide-react"
import JSZip from "jszip"

interface PageData {
  pageId: string
  title: string
  pageType: string
  fullPageId: string
  rowNumber: number
}

const CourseProcessor: React.FC = () => {
  const [xmlContent, setXmlContent] = useState<string>("")
  const [processedData, setProcessedData] = useState<PageData[]>([])
  const [baseCatalogId, setBaseCatalogId] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [showUserGuide, setShowUserGuide] = useState(false)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError("")
    setProcessedData([])
    setBaseCatalogId("")

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setXmlContent(content)
    }
    reader.onerror = () => {
      setError("Failed to read the file")
    }
    reader.readAsText(file)
  }, [])

  const processXML = useCallback(() => {
    setIsProcessing(true)
    setError("")

    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml")

      // Check for parsing errors
      const parserError = xmlDoc.querySelector("parsererror")
      if (parserError) {
        throw new Error("Invalid XML format")
      }

      // Extract baseCatalogId
      const courseElement = xmlDoc.querySelector("course")
      const catalogId = courseElement?.getAttribute("baseCatalogId") || "UNKNOWN"
      setBaseCatalogId(catalogId)

      // Find all page elements and adaptive lesson elements
      const pages = xmlDoc.querySelectorAll("page")
      const adaptiveElements = xmlDoc.querySelectorAll("landing, question, result, wrapUp")

      const uniquePages: PageData[] = []
      const seenQuizScreens = new Set<string>()
      const seenPageIds = new Set<string>()

      // Always add Menu and Launch as the first two entries
      uniquePages.push({
        pageId: "Menu",
        title: "Menu",
        pageType: "menu",
        fullPageId: `${catalogId}_Menu`,
        rowNumber: 0, // Changed from 1 to 0
      })

      uniquePages.push({
        pageId: "Launch",
        title: "Launch",
        pageType: "launch",
        fullPageId: `${catalogId}_Launch`,
        rowNumber: 0, // Changed from 2 to 0
      })

      console.log("Added default Menu and Launch entries")
      console.log(`Found ${pages.length} page elements and ${adaptiveElements.length} adaptive elements`)

      // Process regular pages
      pages.forEach((page, index) => {
        const pageId = page.getAttribute("pageid")
        const pageType = page.getAttribute("type")
        const hidden = page.getAttribute("hidden")

        // Get title and clean up encoding issues
        const titleElement = page.querySelector("title")
        let title = titleElement?.textContent?.trim() || "Untitled"

        // Fix common encoding issues
        title = title
          .replace(/â€™/g, "'") // Fix smart quote
          .replace(/â€œ/g, '"') // Fix left double quote
          .replace(/â€/g, '"') // Fix right double quote
          .replace(/â€"/g, "—") // Fix em dash
          .replace(/â€"/g, "–") // Fix en dash
          .replace(/Â/g, "") // Remove extra Â characters
          .normalize("NFD") // Normalize Unicode
          .replace(/[\u0300-\u036f]/g, "") // Remove combining characters if needed

        console.log(
          `Processing page ${index + 1}: pageId=${pageId}, type=${pageType}, hidden=${hidden}, title=${title}`,
        )

        // Skip if hidden="true"
        if (hidden === "true") {
          console.log(`Skipping hidden page: ${pageId}`)
          return
        }

        // Skip if no pageId or pageType
        if (!pageId || !pageType) {
          console.log(`Skipping page with missing pageId or pageType: ${pageId}, ${pageType}`)
          return
        }

        // Check for duplicate pageIds
        if (seenPageIds.has(pageId)) {
          console.log(`Skipping duplicate pageId: ${pageId}`)
          return
        }
        seenPageIds.add(pageId)

        // Get last 6 digits of pageId
        const last6Digits = pageId.slice(-6)
        const fullPageId = `${catalogId}_${last6Digits}`

        uniquePages.push({
          pageId: last6Digits,
          title,
          pageType,
          fullPageId,
          rowNumber: uniquePages.length + 1,
        })

        console.log(`Added regular page: ${fullPageId}`)
      })

      // Process adaptive lesson elements (landing, question, result, wrapUp)
      adaptiveElements.forEach((element, index) => {
        const pageId = element.getAttribute("pageid")
        const elementType = element.tagName.toLowerCase()

        console.log(`Processing adaptive element ${index + 1}: pageId=${pageId}, elementType=${elementType}`)

        // Skip if no pageId
        if (!pageId) {
          console.log(`Skipping adaptive element with missing pageId: ${elementType}`)
          return
        }

        // Handle adaptive lesson pattern
        if (pageId.includes("adapt_")) {
          const quizMatch = pageId.match(/adapt_(\d+)_(\d+)/)
          if (quizMatch) {
            const lessonNumber = quizMatch[1]
            const pageNumber = quizMatch[2]

            // Only include the first page of each adaptive lesson (adapt_XXX_1)
            if (pageNumber !== "1") {
              console.log(`Skipping adaptive sub-page: ${pageId}`)
              return
            }

            const adaptiveScreenId = `adapt_${lessonNumber}_1`
            if (seenQuizScreens.has(adaptiveScreenId)) {
              console.log(`Skipping duplicate adaptive screen: ${pageId}`)
              return
            }
            seenQuizScreens.add(adaptiveScreenId)

            // For adaptive lessons, get the lesson title from parent topic
            let lessonTitle = "Adaptive Lesson" // Default title

            // Try to find the parent topic element
            const parentTopic = element.closest("topic")
            if (parentTopic) {
              const topicTitleElement = parentTopic.querySelector("title")
              if (topicTitleElement?.textContent?.trim()) {
                lessonTitle = topicTitleElement.textContent.trim()
                console.log(`Using lesson title for ${pageId}: ${lessonTitle}`)
              }
            }

            // Apply encoding fixes to lesson title
            lessonTitle = lessonTitle
              .replace(/â€™/g, "'") // Fix smart quote
              .replace(/â€œ/g, '"') // Fix left double quote
              .replace(/â€/g, '"') // Fix right double quote
              .replace(/â€"/g, "—") // Fix em dash
              .replace(/â€"/g, "–") // Fix en dash
              .replace(/Â/g, "") // Remove extra Â characters
              .normalize("NFD") // Normalize Unicode
              .replace(/[\u0300-\u036f]/g, "") // Remove combining characters if needed

            // Check for duplicate pageIds
            if (seenPageIds.has(pageId)) {
              console.log(`Skipping duplicate adaptive pageId: ${pageId}`)
              return
            }
            seenPageIds.add(pageId)

            // Get last 6 digits of pageId
            const last6Digits = pageId.slice(-6)
            const fullPageId = `${catalogId}_${last6Digits}`

            uniquePages.push({
              pageId: last6Digits,
              title: lessonTitle,
              pageType: "quickQuiz",
              fullPageId,
              rowNumber: uniquePages.length + 1,
            })

            console.log(`Added adaptive page: ${fullPageId}`)
          }
        }
      })

      console.log(`Total unique pages processed: ${uniquePages.length}`)
      setProcessedData(uniquePages)
    } catch (err) {
      console.error("Processing error:", err)
      setError(err instanceof Error ? err.message : "An error occurred while processing the XML")
    } finally {
      setIsProcessing(false)
    }
  }, [xmlContent])

  const generateCSV = useCallback(() => {
    if (processedData.length === 0) return ""

    const headers = ["baseCatalogId_pageid", "title", "page_type"]
    const rows = processedData.map((item) => [
      item.fullPageId,
      `"${item.title.replace(/"/g, '""')}"`, // Escape quotes in CSV
      item.pageType,
    ])

    // Add UTF-8 BOM for proper Excel compatibility
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    return "\uFEFF" + csvContent // UTF-8 BOM
  }, [processedData])

  const downloadCSV = useCallback(() => {
    const csv = generateCSV()
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${baseCatalogId}_course_screens.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generateCSV, baseCatalogId])

  const generateFolderStructure = useCallback(() => {
    return processedData.map((item, index) => {
      // Special handling for Menu and Launch - always use "00"
      if (item.pageType === "menu" || item.pageType === "launch") {
        return `00_${baseCatalogId}_${item.pageId}_${item.pageType}`
      }

      // For all other items, use their actual row number with padding
      const paddedRowNumber = item.rowNumber.toString().padStart(2, "0")
      return `${paddedRowNumber}_${baseCatalogId}_${item.pageId}_${item.pageType}`
    })
  }, [processedData, baseCatalogId])

  const downloadZipFile = useCallback(async () => {
    const folders = generateFolderStructure()

    // Create a new JSZip instance
    const zip = new JSZip()

    // Add each folder to the ZIP file
    folders.forEach((folderName) => {
      // Create an empty folder by adding a placeholder file inside it
      zip.folder(folderName)?.file(".gitkeep", "This file ensures the folder is created in the ZIP archive")
    })

    // Add a README file with instructions
    const readmeContent = [
      `# Course Screen Folders - ${baseCatalogId}`,
      `Generated on: ${new Date().toLocaleString()}`,
      `Total folders: ${folders.length}`,
      "",
      "## Folder Structure:",
      "Each folder follows the naming convention:",
      "(Row Number)_(baseCatalogId)_(pageid)_(page type)",
      "",
      "## Contents:",
      ...folders.map((folder, index) => `${index + 1}. ${folder}`),
      "",
      "## Usage:",
      "Extract this ZIP file to create all the course screen folders.",
      "Each folder contains a .gitkeep file to ensure it exists in the archive.",
    ].join("\n")

    zip.file("README.txt", readmeContent)

    // Generate the ZIP file
    try {
      const content = await zip.generateAsync({ type: "blob" })

      // Download the ZIP file
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseCatalogId}_course_folders.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      setError("Failed to create ZIP file: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }, [generateFolderStructure, baseCatalogId])

  return (
    <div className="flex min-h-screen justify-center">
      <div className={`w-full max-w-4xl mx-auto p-6 space-y-6 transition-all duration-300 ${showUserGuide ? "-translate-x-60" : ""}`}>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Catalyst Screen Collator
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUserGuide(true)}
                className="flex items-center gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                User Guide
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="xml-upload">Upload Course XML File</Label>
                <div className="flex items-center gap-2">
                  <Input id="xml-upload" type="file" accept=".xml" onChange={handleFileUpload} className="flex-1" />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                {fileName && <p className="text-sm text-muted-foreground">Loaded: {fileName}</p>}
              </div>

              <Button onClick={processXML} disabled={isProcessing || !xmlContent} className="w-full">
                {isProcessing ? "Processing..." : "Process XML"}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {processedData.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm">
                    <strong>Base Catalog ID:</strong> {baseCatalogId}
                  </div>
                  <div className="text-sm">
                    <strong>Unique Screens Found:</strong> {processedData.length}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={downloadCSV} variant="outline" className="flex-1 bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                  <Button onClick={downloadZipFile} variant="outline" className="flex-1 bg-transparent">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Download ZIP File
                  </Button>
                </div>

                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold mb-2">Preview (First 10 screens):</h3>
                  <div className="space-y-1 text-sm font-mono">
                    <div className="grid grid-cols-3 gap-4 py-1 border-b font-semibold">
                      <span>Page ID</span>
                      <span>Title</span>
                      <span>Type</span>
                    </div>
                    {processedData.slice(0, 10).map((item, index) => (
                      <div key={index} className="grid grid-cols-3 gap-4 py-1 border-b">
                        <span>{item.fullPageId}</span>
                        <span className="truncate" title={item.title}>
                          {item.title}
                        </span>
                        <span>{item.pageType}</span>
                      </div>
                    ))}
                    {processedData.length > 10 && (
                      <div className="text-muted-foreground italic">... and {processedData.length - 10} more screens</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Guide Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full bg-white w-1/3 shadow-lg p-6 overflow-y-auto transition-transform duration-300 ease-in-out transform ${
          showUserGuide ? "translate-x-0" : "translate-x-full"
        } z-50`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">User Guide</h2>
          <Button variant="outline" size="sm" onClick={() => setShowUserGuide(false)}>
            ✕
          </Button>
        </div>

        <div className="space-y-6 text-sm">
          <div>
            <h3 className="font-semibold text-lg mb-2">Step 1: Login to Catalyst Design</h3>
            <p>First, login to Catalyst Design platform.</p>
            <img src="images/step1.png" alt="Step 1: Login" className="mt-2 rounded-lg border" />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Step 2: Find Your Course</h3>
            <p>From the Course List landing page, search for the course you need the screen list from.</p>
            <img src="images/step2.png" alt="Step 2: Find Course" className="mt-2 rounded-lg border" />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Step 3: Download XML</h3>
            <p>Once the course is shown:</p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Click the 3 Dots menu on the extreme right of the course list</li>
              <li>Rollover "Export and Download"</li>
              <li>Select "Download XML"</li>
            </ol>
            <img src="images/step3.png" alt="Step 3: Download XML" className="mt-2 rounded-lg border" />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Step 4: Extract the XML File</h3>
            <p>Once downloaded you will find a zip file with the course code:</p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Extract or navigate to the innermost folder</li>
              <li>
                You will find <code className="bg-gray-100 px-1 rounded">Course.xml</code>
              </li>
            </ol>
            <img src="images/step4.png" alt="Step 4: Extract XML" className="mt-2 rounded-lg border" />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Step 5: Upload to Screen Collator</h3>
            <p>Use the file upload feature above to select your Course.xml file.</p>
            <img src="images/step5.png" alt="Step 5: Upload to Collator" className="mt-2 rounded-lg border" />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Step 6: Process and Download</h3>
            <p>After processing, you'll get two downloadable files:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <strong>CSV Spreadsheet:</strong> Contains the Screen Row List ready to copy and paste to the
                production server. You may need to stretch column widths to see all text.
              </li>
              <li>
                <strong>ZIP File:</strong> Contains the Course Folder Structure, ready to drag and drop to the
                Graphic Design Production folder.
              </li>
            </ul>
            <img src="images/step6.png" alt="Step 6: Process and Download" className="mt-2 rounded-lg border" />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Note:</h4>
            <p className="text-yellow-700">
              On occasion, the ZIP file may not correctly create with the folders contained. If this happens,
              simply click the "Download ZIP File" button again to regenerate it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseProcessor
