'use client'
import type { FC } from 'react'
import React, { useEffect, useRef, useState, Dispatch, SetStateAction } from 'react'
import cn from 'classnames'
import { useTranslation } from 'react-i18next'
import Textarea from 'rc-textarea'
import s from './style.module.css'
import Answer from './answer'
import Question from './question'
import type { FeedbackFunc } from './type'
import type { ChatItem, VisionFile, VisionSettings } from '@/types/app'
import { TransferMethod } from '@/types/app'
// import Tooltip from '@/app/components/base/tooltip'
import Toast from '@/app/components/base/toast'
import ChatImageUploader from '@/app/components/base/image-uploader/chat-image-uploader'
import ImageList from '@/app/components/base/image-uploader/image-list'
import { useImageFiles } from '@/app/components/base/image-uploader/hooks'
import { Mic, MicOff, Volume2, VolumeOff } from 'lucide-react'

// Define the SpeechRecognition type
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
  onend: () => void;
}

// Define the window with SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export type IChatProps = {
  chatList: ChatItem[]
  /**
   * Whether to display the editing area and rating status
   */
  feedbackDisabled?: boolean
  /**
   * Whether to display the input area
   */
  isHideSendInput?: boolean
  onFeedback?: FeedbackFunc
  checkCanSend?: () => boolean
  onSend?: (message: string, files: VisionFile[]) => void
  useCurrentUserAvatar?: boolean
  isResponding?: boolean
  controlClearQuery?: number
  visionConfig?: VisionSettings
  setDoTTS?: Dispatch<SetStateAction<boolean>>
  isMobile: boolean
}

const Chat: FC<IChatProps> = ({
  chatList,
  feedbackDisabled = true,
  isHideSendInput = false,
  onFeedback,
  checkCanSend,
  onSend = () => { },
  useCurrentUserAvatar,
  isResponding,
  controlClearQuery,
  visionConfig,
  setDoTTS,
  isMobile
}) => {
  const { t } = useTranslation()
  const { notify } = Toast
  const isUseInputMethod = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const [isVolumeOn, setVolumeOn] = useState(false)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const inputFormRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = React.useState('')
  const handleContentChange = (e: any) => {
    const value = e.target.value
    setQuery(value)
  }

  const logError = (message: string) => {
    notify({ type: 'error', message, duration: 3000 })
  }

  const valid = () => {
    if (!query || query.trim() === '') {
      logError('Message cannot be empty')
      return false
    }
    return true
  }

  useEffect(() => {
    if (controlClearQuery)
      setQuery('')
  }, [controlClearQuery])

  // Setup SpeechRecognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser')
      return
    }

    // Initialize recognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ja-JP' // Default language, could be made configurable

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('')

      // Update query with transcribed text
      setQuery(prevQuery => {
        const lastResult = event.results[event.results.length - 1]
        // Only use final results to avoid jittery text updates
        if (lastResult.isFinal) {
          return prevQuery + ' ' + lastResult[0].transcript
        }
        return prevQuery
      })
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event)
      setIsListening(false)
      // notify({ type: 'error', message: 'Speech recognition error', duration: 3000 })
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [recognitionRef])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      notify({ type: 'error', message: 'Speech recognition not supported in your browser', duration: 3000 })
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const toggleVolumeOn = () => {
    if (isVolumeOn) {
      setVolumeOn(false)
      if (setDoTTS) setDoTTS(false)

    } else {
      setVolumeOn(true)
      if (setDoTTS) setDoTTS(true)
    }
  }

  const {
    files,
    onUpload,
    onRemove,
    onReUpload,
    onImageLinkLoadError,
    onImageLinkLoadSuccess,
    onClear,
  } = useImageFiles()

  const handleSend = () => {
    if (!valid() || (checkCanSend && !checkCanSend()))
      return
    onSend(query, files.filter(file => file.progress !== -1).map(fileItem => ({
      type: 'image',
      transfer_method: fileItem.type,
      url: fileItem.url,
      upload_file_id: fileItem.fileId,
    })))
    if (!files.find(item => item.type === TransferMethod.local_file && !item.fileId)) {
      if (files.length)
        onClear()
      if (!isResponding)
        setQuery('')
    }
  }

  const handleKeyUp = (e: any) => {
    if (e.code === 'Enter') {
      e.preventDefault()
      // prevent send message when using input method enter
      if (!e.shiftKey && !isUseInputMethod.current)
        handleSend()
    }
  }

  const handleKeyDown = (e: any) => {
    isUseInputMethod.current = e.nativeEvent.isComposing
    if (e.code === 'Enter' && !e.shiftKey) {
      setQuery(query.replace(/\n$/, ''))
      e.preventDefault()
    }
  }



  useEffect(() => {
    // Function to update the orientation state
    function updateOrientation() {
      if (isMobile) {
        inputFormRef.current?.classList.remove("pc:left-[244px]")
        inputFormRef.current?.classList.remove("tablet:left-[192px]")
        inputFormRef.current?.classList.remove("mobile:left-[240px]")
      }
      else {
        inputFormRef.current?.classList.add("pc:left-[244px]")
        inputFormRef.current?.classList.add("tablet:left-[192px]")
        inputFormRef.current?.classList.add("mobile:left-[240px]")

      }
    }
    // Initial update of the orientation state
    updateOrientation();
    // Add an event listener for orientation change
    window.addEventListener("orientationchange", updateOrientation);
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, [inputFormRef, isMobile]);

  return (
    <>
      {/* Chat List */}
      <div className="chat-answer">
        {(chatList.length > 0) && <Answer
          key={chatList[chatList.length - 1].id}
          item={chatList[chatList.length - 1]}
          feedbackDisabled={feedbackDisabled}
          onFeedback={onFeedback}
          isResponding={isResponding}
          isMobile={isMobile}
        />
        }
      </div>
      {
        !isHideSendInput && (
          <div className='input-form'>
            <div ref={inputFormRef} className='input-container left-0'>
              <Textarea
                className='chat-input'
                value={query}
                onChange={handleContentChange}
                onKeyUp={handleKeyUp}
                onKeyDown={handleKeyDown}
                autoSize
              />
              <div className="absolute left-[31px] flex items-center">
                <div
                  className={`w-8 h-8 flex items-center justify-center cursor-pointer rounded-md ${isVolumeOn ? 'hover:bg-gray-100' : 'bg-red-100'}`}
                  onClick={toggleVolumeOn}
                >
                  {isVolumeOn ? <Volume2 size={18} className="text-gray-500" /> : <VolumeOff size={18} className="text-red-500" />}
                </div>
              </div>
              <div className="absolute right-[31px] flex items-center h-8">
                <div className={`${s.sendBtn} w-8 h-8 cursor-pointer rounded-md`} onClick={handleSend}></div>
              </div>
            </div>
          </div>
        )
      }
    </>
  )
}

export default React.memo(Chat)