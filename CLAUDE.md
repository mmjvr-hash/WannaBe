# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file browser-based Tic Tac Toe game. No build step, no dependencies, no package manager — just `tictactoe.html`.

## Running the Game

Open `tictactoe.html` directly in a browser. No server required.

## Architecture

Everything lives in `tictactoe.html`:

- **State**: `board` (9-element array), `current` (active player `'X'`/`'O'`), `gameOver`, `mode` (`'2p'` or `'ai'`), `scores`
- **Rendering**: `renderBoard()` rebuilds the grid from scratch on every state change
- **Win detection**: `checkWin()` tests all 8 winning combinations defined in `WINS`
- **AI** (`bestMove()`): rule-based — win if possible → block opponent → take center → take corner → random open cell
- **Game flow**: `makeMove(i)` is the single entry point for both human clicks and AI moves; it mutates state, re-renders, checks end conditions, and schedules the AI turn if needed
