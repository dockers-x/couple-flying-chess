"use client"

import { useState, useEffect, useCallback } from "react"
import { createBoardPath, type PathCell } from "@/lib/game-config"
import {
  Rocket,
  Trophy,
  Star,
  Bomb,
  Plane,
  BirdIcon as Helicopter,
  Heart,
  Sparkles,
  CheckCircle,
  XCircle,
  RotateCcw,
  Users,
  Flame,
  Lock,
  Shuffle,
  ArrowLeft,
} from "lucide-react"
import type { JSX } from "react/jsx-runtime"
import { type Language, type Translations, loadTranslations, interpolate } from "@/lib/i18n"
import LanguageSelector from "./language-selector"

type GameState = "start" | "playing" | "task" | "win" | "moving"
type GameMode = "normal" | "love" | "couple" | "advanced" | "intimate" | "mixed"
type PlayerColor = "red" | "blue"
type TaskType = "star" | "trap" | "collision"

interface CurrentTask {
  description: string
  executor: PlayerColor
  target: PlayerColor
}

// Shuffle function (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// Game mode configurations
const gameModeIcons = {
  normal: Users,
  love: Heart,
  couple: Sparkles,
  advanced: Flame,
  intimate: Lock,
  mixed: Shuffle,
}

const gameModeColors = {
  normal: "from-blue-400 to-blue-600",
  love: "from-pink-400 to-pink-600",
  couple: "from-purple-400 to-purple-600",
  advanced: "from-red-400 to-red-600",
  intimate: "from-gray-700 to-gray-900",
  mixed: "from-indigo-400 via-purple-500 to-pink-500",
}

const gameModeEmojis = {
  normal: "😊",
  love: "💕",
  couple: "💖",
  advanced: "🔥",
  intimate: "🔒",
  mixed: "🎲",
}

export default function CoupleLudoGame() {
  const [gameState, setGameState] = useState<GameState>("start")
  const [gameMode, setGameMode] = useState<GameMode>("normal")
  const [boardPath, setBoardPath] = useState<PathCell[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>("red")
  const [redPosition, setRedPosition] = useState(0)
  const [bluePosition, setBluePosition] = useState(0)
  const [diceValue, setDiceValue] = useState<number | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null)
  const [taskType, setTaskType] = useState<TaskType | null>(null)
  const [winner, setWinner] = useState<PlayerColor | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [taskQueue, setTaskQueue] = useState<string[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [language, setLanguage] = useState<Language>("zh")
  const [translations, setTranslations] = useState<Translations | null>(null)

  useEffect(() => {
    const path = createBoardPath()
    setBoardPath(path)

    // Load initial language
    loadTranslations(language).then(setTranslations)
  }, [])

  useEffect(() => {
    loadTranslations(language).then(setTranslations)
  }, [language])

  const loadTasks = useCallback(
    async (mode: GameMode, lang: Language) => {
      setIsLoadingTasks(true)
      console.log(`Loading tasks for mode: ${mode}, language: ${lang}`)

      try {
        // Try to load language-specific tasks first
        let response = await fetch(`/tasks/${mode}-${lang}.json`)
        console.log(`First attempt response status: ${response.status}`)

        // If language-specific tasks don't exist, fall back to Chinese
        if (!response.ok && lang !== "zh") {
          console.log(`Falling back to Chinese tasks for mode: ${mode}`)
          response = await fetch(`/tasks/${mode}.json`)
          console.log(`Fallback response status: ${response.status}`)
        }

        if (!response.ok) {
          throw new Error(`Failed to load tasks for mode: ${mode}, status: ${response.status}`)
        }

        const tasks: string[] = await response.json()
        console.log(`Loaded ${tasks.length} tasks:`, tasks.slice(0, 3))

        if (tasks.length === 0) {
          throw new Error(`Task file is empty for mode: ${mode}`)
        }

        setTaskQueue(shuffleArray(tasks))
      } catch (error) {
        console.error("Error loading tasks:", error)

        // 提供更丰富的备用任务
        const fallbackTasks = [
          "学猫叫三声",
          "一起恶搞自拍",
          "给对方说悄悄话",
          "给对方按小腿1分钟",
          "对视5秒",
          "喂对方喝水",
          "手牵手30秒",
          "拥抱30秒",
          "给对方唱首歌",
          "一起喝一杯水",
          "拍一段表白的视频留作纪念",
          "给对方梳头发",
          "给对方按摩捶背1分钟",
          "亲吻对方手背30秒",
          "拥抱一分钟",
          "一起恶搞自拍",
          "亲吻一下对方的手",
          "从背后抱对方1分钟",
          "亲吻对方额头",
        ]

        console.log(`Using fallback tasks: ${fallbackTasks.length} tasks`)
        setTaskQueue(shuffleArray(fallbackTasks))
      } finally {
        setIsLoadingTasks(false)
      }
    },
    [translations],
  )

  const switchTurn = useCallback(() => {
    setCurrentPlayer((prev) => (prev === "red" ? "blue" : "red"))
  }, [])

  const checkSpecialEvents = useCallback(
    (newPosition: number, player: PlayerColor) => {
      setIsMoving(false)
      setGameState("playing")

      const otherPlayerPosition = player === "red" ? bluePosition : redPosition

      if (newPosition === otherPlayerPosition && newPosition !== 0 && newPosition !== boardPath.length - 1) {
        setTimeout(() => {
          setTaskType("collision")
          triggerTask("collision", player)
        }, 300)
        return
      }

      // 只有正好到达终点才获胜
      if (newPosition === boardPath.length - 1) {
        setTimeout(() => {
          setWinner(player)
          setGameState("win")
        }, 300)
        return
      }

      const cellType = boardPath[newPosition]?.type
      if (cellType === "star") {
        setTimeout(() => {
          setTaskType("star")
          triggerTask("star", player)
        }, 300)
      } else if (cellType === "trap") {
        setTimeout(() => {
          setTaskType("trap")
          triggerTask("trap", player)
        }, 300)
      } else {
        setTimeout(switchTurn, 300)
      }
    },
    [boardPath, bluePosition, redPosition, switchTurn],
  )

  const movePlayerStep = useCallback(
    (targetPosition: number, player: PlayerColor, currentStepPos?: number) => {
      const startPosition = currentStepPos ?? (player === "red" ? redPosition : bluePosition)

      if (startPosition >= targetPosition) {
        checkSpecialEvents(targetPosition, player)
        return
      }

      const nextPosition = startPosition + 1
      if (player === "red") setRedPosition(nextPosition)
      else setBluePosition(nextPosition)

      setTimeout(() => movePlayerStep(targetPosition, player, nextPosition), 300)
    },
    [redPosition, bluePosition, checkSpecialEvents],
  )

  const movePlayer = useCallback(
    (steps: number) => {
      const currentPos = currentPlayer === "red" ? redPosition : bluePosition
      const maxPosition = boardPath.length - 1
      let targetPosition = currentPos + steps

      // 如果超出终点，需要反弹回来
      if (targetPosition > maxPosition) {
        const overshoot = targetPosition - maxPosition
        targetPosition = maxPosition - overshoot
        // 确保不会反弹到负数位置
        targetPosition = Math.max(0, targetPosition)
      }

      setIsMoving(true)
      setGameState("moving")

      if (targetPosition === currentPos) {
        checkSpecialEvents(targetPosition, currentPlayer)
      } else {
        movePlayerStep(targetPosition, currentPlayer)
      }
    },
    [currentPlayer, redPosition, bluePosition, boardPath.length, movePlayerStep, checkSpecialEvents],
  )

  const rollDice = () => {
    if (isRolling || isMoving || isLoadingTasks) return
    setIsRolling(true)
    setDiceValue(null)

    let count = 0
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1)
      count++
      if (count > 10) {
        clearInterval(interval)
        const finalValue = Math.floor(Math.random() * 6) + 1
        setDiceValue(finalValue)
        setIsRolling(false)
        movePlayer(finalValue)
      }
    }, 80)
  }

  const triggerTask = (type: TaskType, PCOnCell: PlayerColor) => {
    console.log(`Triggering task. Queue length: ${taskQueue.length}, Type: ${type}, Player: ${PCOnCell}`)

    if (taskQueue.length === 0) {
      console.warn("Task queue is empty!")
      const emptyMessage = translations?.tasks.emptyQueue || "任务队列空了！休息一下吧！"
      setCurrentTask({ description: emptyMessage, executor: PCOnCell, target: PCOnCell })
      setGameState("task")
      return
    }

    const currentTaskDescription = taskQueue[0]
    console.log(`Selected task: ${currentTaskDescription}`)

    setTaskQueue((prev) => {
      const newQueue = [...prev.slice(1), prev[0]]
      console.log(`New queue length: ${newQueue.length}`)
      return newQueue
    })

    let executor: PlayerColor
    if (type === "star") {
      executor = PCOnCell === "red" ? "blue" : "red"
    } else if (type === "trap") {
      executor = PCOnCell
    } else {
      executor = PCOnCell === "red" ? "blue" : "red"
    }

    setCurrentTask({ description: currentTaskDescription, executor, target: PCOnCell })
    setGameState("task")
  }

  const animateTaskOutcomeMove = useCallback(
    (targetPosition: number, player: PlayerColor, originalPosition: number) => {
      setIsMoving(true)
      setGameState("moving")

      let currentAnimatedPos = originalPosition

      const step = () => {
        if (currentAnimatedPos === targetPosition) {
          setIsMoving(false)
          setGameState("playing")
          setCurrentTask(null)
          setTaskType(null)

          // 只有正好到达终点才获胜
          if (targetPosition === boardPath.length - 1) {
            setWinner(player)
            setGameState("win")
          } else {
            switchTurn()
          }
          return
        }

        currentAnimatedPos += targetPosition > currentAnimatedPos ? 1 : -1

        if (player === "red") setRedPosition(currentAnimatedPos)
        else setBluePosition(currentAnimatedPos)

        setTimeout(step, 300)
      }
      step()
    },
    [boardPath.length, switchTurn],
  )

  const handleTaskComplete = (isCompleted: boolean) => {
    if (!currentTask || !translations) return

    const activePlayer = currentTask.executor
    const currentPosition = activePlayer === "red" ? redPosition : bluePosition
    const maxPosition = boardPath.length - 1
    let finalPosition = currentPosition
    let toastMessage = ""
    let toastType: "success" | "error" = "success"

    if (taskType === "star" || taskType === "trap") {
      const rewardSteps = Math.floor(Math.random() * 4) // 0-3格
      const penaltySteps = Math.floor(Math.random() * 4) + 3 // 3-6格

      if (isCompleted) {
        let newPosition = currentPosition + rewardSteps
        // 处理超出终点的反弹
        if (newPosition > maxPosition) {
          const overshoot = newPosition - maxPosition
          newPosition = maxPosition - overshoot
          newPosition = Math.max(0, newPosition)
        }
        finalPosition = newPosition

        if (rewardSteps === 0) {
          toastMessage = activePlayer === "red" ? translations.toast.redStay : translations.toast.blueStay
        } else {
          const template = activePlayer === "red" ? translations.toast.redForward : translations.toast.blueForward
          toastMessage = interpolate(template, { steps: rewardSteps.toString() })
        }
        toastType = "success"
      } else {
        finalPosition = Math.max(currentPosition - penaltySteps, 0)
        const template = activePlayer === "red" ? translations.toast.redBackward : translations.toast.blueBackward
        toastMessage = interpolate(template, { steps: penaltySteps.toString() })
        toastType = "error"
      }
    } else if (taskType === "collision") {
      const executorPlayer = currentTask.executor
      if (!isCompleted) {
        if (executorPlayer === "red") {
          setRedPosition(0)
          toastMessage = translations.toast.redFailedToStart
        } else {
          setBluePosition(0)
          toastMessage = translations.toast.blueFailedToStart
        }
        toastType = "error"
        setCurrentTask(null)
        setTaskType(null)
        setToast({ message: toastMessage, type: toastType })
        setTimeout(() => setToast(null), 3000)
        setGameState("playing")
        switchTurn()
        return
      } else {
        toastMessage = executorPlayer === "red" ? translations.toast.redCompleted : translations.toast.blueCompleted
        toastType = "success"
        setCurrentTask(null)
        setTaskType(null)
        setToast({ message: toastMessage, type: toastType })
        setTimeout(() => setToast(null), 3000)
        setGameState("playing")
        switchTurn()
        return
      }
    }

    setToast({ message: toastMessage, type: toastType })
    setTimeout(() => setToast(null), 3000)

    if (finalPosition !== currentPosition && (taskType === "star" || taskType === "trap")) {
      animateTaskOutcomeMove(finalPosition, activePlayer, currentPosition)
    } else {
      setCurrentTask(null)
      setTaskType(null)
      setGameState("playing")
      // 只有正好到达终点才获胜
      if (finalPosition === maxPosition && (taskType === "star" || taskType === "trap")) {
        setWinner(activePlayer)
        setGameState("win")
      } else {
        switchTurn()
      }
    }
  }

  const startGame = async (mode: GameMode) => {
    setGameMode(mode)
    await loadTasks(mode, language)

    const newPath = createBoardPath()
    setBoardPath(newPath)

    setGameState("playing")
    setRedPosition(0)
    setBluePosition(0)
    setCurrentPlayer("red")
    setDiceValue(null)
    setWinner(null)
    setIsMoving(false)
    setIsRolling(false)
  }

  const restartGame = () => {
    setGameState("start")
  }

  const handleLanguageChange = async (newLanguage: Language) => {
    setLanguage(newLanguage)
    // Reload tasks if game is in progress
    if (gameState !== "start" && gameMode) {
      await loadTasks(gameMode, newLanguage)
    }
  }

  const renderBoard = () => {
    if (!translations) return null

    const boardGridSize = 7
    const cells = []
    const cellElements: { [key: string]: JSX.Element } = {}

    boardPath.forEach((pathCell) => {
      const isRedOnCell = redPosition === pathCell.id
      const isBlueOnCell = bluePosition === pathCell.id
      const areBothOnCell = isRedOnCell && isBlueOnCell
      const playerIconSize = areBothOnCell ? 18 : 24

      cellElements[`${pathCell.y}-${pathCell.x}`] = (
        <div key={`${pathCell.y}-${pathCell.x}`} className={`cell ${pathCell.type}`}>
          <div className="cell-number">{pathCell.id}</div>
          {pathCell.type === "start" && (
            <div className="cell-icon-text">
              <Rocket size={18} /> <p>{translations.board.start}</p>
            </div>
          )}
          {pathCell.type === "end" && (
            <div className="cell-icon-text">
              <Trophy size={18} /> <p>{translations.board.end}</p>
            </div>
          )}
          {pathCell.type === "star" && (
            <div className="cell-icon-text">
              <Star size={16} /> <p>{translations.board.star}</p>
            </div>
          )}
          {pathCell.type === "trap" && (
            <div className="cell-icon-text">
              <Bomb size={16} /> <p>{translations.board.trap}</p>
            </div>
          )}
          {pathCell.type === "path" && <div className="cell-icon-text">•</div>}

          {isRedOnCell && (
            <div
              className={`player red ${currentPlayer === "red" ? "current-turn" : ""} ${areBothOnCell ? "stacked" : ""} ${isMoving && currentPlayer === "red" ? "moving" : ""}`}
            >
              <Plane size={playerIconSize} />
            </div>
          )}
          {isBlueOnCell && (
            <div
              className={`player blue ${currentPlayer === "blue" ? "current-turn" : ""} ${areBothOnCell ? "stacked" : ""} ${isMoving && currentPlayer === "blue" ? "moving" : ""}`}
            >
              <Helicopter size={playerIconSize} />
            </div>
          )}
        </div>
      )
    })

    for (let r = 0; r < boardGridSize; r++) {
      for (let c = 0; c < boardGridSize; c++) {
        if (cellElements[`${r}-${c}`]) {
          cells.push(cellElements[`${r}-${c}`])
        } else {
          cells.push(<div key={`${r}-${c}`} className="cell empty"></div>)
        }
      }
    }
    return cells
  }

  const renderPathLines = () => {
    if (!boardPath || boardPath.length === 0) return null
    const lines = []
    const cellSize = 100 / 7

    for (let i = 0; i < boardPath.length - 1; i++) {
      const current = boardPath[i]
      const next = boardPath[i + 1]
      const startX = (current.x + 0.5) * cellSize
      const startY = (current.y + 0.5) * cellSize
      const endX = (next.x + 0.5) * cellSize
      const endY = (next.y + 0.5) * cellSize
      const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
      const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI
      const centerX = (startX + endX) / 2
      const centerY = (startY + endY) / 2
      lines.push(
        <div
          key={`line-${i}`}
          className="path-line"
          style={{
            width: `${length}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            top: `${centerY}%`,
            left: `${centerX}%`,
          }}
        />,
      )
    }
    return lines
  }

  if (!translations) {
    return (
      <div className="game-container start-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (gameState === "start") {
    return (
      <div className="game-container start-container">
        <div className="start-header">
          <div className="start-header-content">
            <div className="game-logo">
              <div className="main-title-area">
                <div className="game-title-main">{translations.game.title}</div>
                <div className="game-subtitle-main">{translations.game.subtitle}</div>
                {/* 在这里添加语言选择器 */}
                <div className="title-language-selector">
                  <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="start-content">
          <div className="welcome-section">
            <h2 className="welcome-title">{translations.game.selectMode}</h2>
            <p className="welcome-description">{translations.game.modeDescription}</p>
          </div>

          <div className="modes-grid">
            {Object.entries(translations.modes).map(([key, mode]) => {
              const IconComponent = gameModeIcons[key as GameMode]
              return (
                <div
                  key={key}
                  className={`mode-card ${key === "intimate" ? "intimate-card" : ""}`}
                  onClick={() => !isLoadingTasks && startGame(key as GameMode)}
                >
                  <div className={`mode-gradient bg-gradient-to-br ${gameModeColors[key as GameMode]}`}>
                    <div className="mode-icon-container">
                      <IconComponent size={24} className="mode-icon" />
                      <span className="mode-emoji">{gameModeEmojis[key as GameMode]}</span>
                    </div>
                  </div>

                  <div className="mode-info">
                    <h3 className="mode-title">{mode.name}</h3>
                    <p className="mode-desc">{mode.description}</p>

                    {isLoadingTasks && gameMode === key && (
                      <div className="loading-indicator">
                        <div className="loading-spinner"></div>
                        <span>{translations.common.loading}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="game-tips">
            <div className="tip-item">
              <Users size={18} />
              <span>{translations.tips.twoPlayers}</span>
            </div>
            <div className="tip-item">
              <Heart size={18} />
              <span>{translations.tips.faceToFace}</span>
            </div>
            <div className="tip-item">
              <Sparkles size={18} />
              <span>{translations.tips.improveRelation}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`game-container ${currentPlayer}-turn`}>
      <div className={`header ${currentPlayer}-turn`}>
        <button className="back-button" onClick={restartGame} title={translations.game.backToHome}>
          <ArrowLeft size={20} />
        </button>
        <span className="header-title">
          {translations.game.title} - {translations.modes[gameMode].name}
        </span>
        <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
      </div>
      <div className="content">
        <div className={`turn-indicator ${currentPlayer}`}>
          {currentPlayer === "red" ? translations.game.redTurn : translations.game.blueTurn}
        </div>
        <div className={`dice-area ${currentPlayer}-turn`}>
          <div className={`dice ${currentPlayer}-turn`}>{diceValue ?? "?"}</div>
          <button
            className={`button ${currentPlayer === "blue" ? "blue" : ""}`}
            onClick={rollDice}
            disabled={isRolling || isMoving || gameState === "task" || isLoadingTasks}
          >
            {isMoving
              ? translations.common.moving
              : isRolling
                ? translations.common.rolling
                : isLoadingTasks
                  ? translations.common.preparing
                  : translations.common.rollDice}
          </button>
        </div>
        <div className="board-container">
          <div className="board">{renderBoard()}</div>
          <div className="path-lines-container">{renderPathLines()}</div>
        </div>
      </div>

      {gameState === "task" && currentTask && (
        <div className="modal">
          <div className="modal-content">
            <h2>{translations.tasks.challenge}</h2>
            <div className={`task-card ${currentTask.executor}-executor`}>
              <div className="task-title">
                {taskType === "star"
                  ? translations.tasks.starTask
                  : taskType === "trap"
                    ? translations.tasks.trapTask
                    : translations.tasks.collisionTask}
              </div>
              <div className={`executor ${currentTask.executor}`}>
                {currentTask.executor === "red" ? translations.tasks.redExecute : translations.tasks.blueExecute}
              </div>
              <div className="task-description">{currentTask.description}</div>
              <div className="task-rewards">
                {taskType === "star" && (
                  <div className="reward-info">
                    <div className="reward-success">{translations.tasks.completedReward}</div>
                    <div className="reward-fail">{translations.tasks.failedPenalty}</div>
                  </div>
                )}
                {taskType === "trap" && (
                  <div className="reward-info">
                    <div className="reward-success">{translations.tasks.completedReward}</div>
                    <div className="reward-fail">{translations.tasks.failedPenalty}</div>
                  </div>
                )}
                {taskType === "collision" && (
                  <div className="reward-info">
                    <div className="reward-success">{translations.tasks.collisionCompletedReward}</div>
                    <div className="reward-fail">{translations.tasks.collisionFailedPenalty}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="task-buttons">
              <button className="task-button complete-btn" onClick={() => handleTaskComplete(true)}>
                ✅ {translations.common.completed}
              </button>
              <button className="task-button fail-btn" onClick={() => handleTaskComplete(false)}>
                ❌ {translations.common.failed}
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === "win" && winner && (
        <div className="modal">
          <div className="modal-content">
            <div className="win-message">{winner === "red" ? translations.game.redWin : translations.game.blueWin}</div>
            <button className="button" onClick={restartGame}>
              <RotateCcw size={16} style={{ marginRight: "8px" }} /> {translations.common.restart}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
