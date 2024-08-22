import React, { useState, useRef } from 'react';
import Chess from "chess.js";
import { Chessboard } from 'react-chessboard';

function TestChessBoard() {
    const [game, setGame] = useState(new Chess());
    const [currentTimeout, setCurrentTimeout] = useState();
    const chessboardRef = useRef(null);
    console.log(game.History);

    function safeGameMutate(modify) {
        setGame(g => {
            const update = { ...g };
            modify(update);
            return update;
        });
    }

    function makeRandomMove() {
        const possibleMoves = game.moves();

        // exit if the game is over
        if (game.game_over() || game.in_draw() || possibleMoves.length === 0) return;
        const randomIndex = Math.floor(Math.random() * possibleMoves.length);
        safeGameMutate(game => {
            game.move(possibleMoves[randomIndex]);
        });
    }

    function onDrop(sourceSquare, targetSquare, piece) {
        const gameCopy = { ...game };
        const move = gameCopy.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase() ?? "q"
        });
        setGame(gameCopy);

        // illegal move
        if (move === null) return false;

        // store timeout so it can be cleared on undo/reset so computer doesn't execute move
        const newTimeout = setTimeout(makeRandomMove, 2000);
        setCurrentTimeout(newTimeout);
        return true;
    }

    return (
        <div>
            <Chessboard
                id="PremovesEnabled"
                arePremovesAllowed={true}
                position={game.fen()}
                isDraggablePiece={({ piece }) => piece[0] === "w"}
                onPieceDrop={onDrop}
                customBoardStyle={{
                    borderRadius: "4px",
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)"
                }}
                ref={chessboardRef}
                allowDragOutsideBoard={false}
            />
            <button onClick={() => {
                safeGameMutate(game => {
                    game.reset();
                });
                // clear premove queue
                chessboardRef.current?.clearPremoves();
                // stop any current timeouts
                clearTimeout(currentTimeout);
            }}>
                reset
            </button>
            <button onClick={() => {
                // undo twice to undo computer move too
                safeGameMutate(game => {
                    game.undo();
                    game.undo();
                });
                // clear premove queue
                chessboardRef.current?.clearPremoves();
                // stop any current timeouts
                clearTimeout(currentTimeout);
            }}>
                undo
            </button>
        </div>
    );
}

export default TestChessBoard;