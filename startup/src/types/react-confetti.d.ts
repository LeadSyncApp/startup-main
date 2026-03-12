declare module 'react-confetti' {
    import * as React from 'react';

    export interface ConfettiProps {
        width?: number;
        height?: number;
        numberOfPieces?: number;
        recycle?: boolean;
        run?: boolean;
        wind?: number;
        gravity?: number;
        initialVelocityX?: number;
        initialVelocityY?: number;
        colors?: string[];
        opacity?: number;
        drawShape?: (ctx: CanvasRenderingContext2D) => void;
    }

    export default class Confetti extends React.Component<ConfettiProps> { }
}
