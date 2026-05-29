#!/bin/bash

echo "Starting Voice Calendar Tool..."
echo

echo "Starting Backend Server..."
cd backend
python main.py &
BACKEND_PID=$!

echo "Starting Frontend Server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo
echo "Both servers are starting..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
