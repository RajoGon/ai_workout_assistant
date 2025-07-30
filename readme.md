// Direct embedding search
const results = await searchWorkoutEmbeddings([0.15, 0.25, 0.35, ...], 5);

// Search with text (auto-generates embedding)
const textResults = await searchWithText("leg workout", {
table: 'WorkoutEmbeddings',
embeddingColumn: 'embedding',
contentColumn: 'content',
limit: 5
});

// Generic vector search with additional columns
const customResults = await vectorSearch({
table: 'ProductEmbeddings',
embeddingColumn: 'embedding',
contentColumn: 'description',
additionalColumns: ['title', 'price', 'category'],
queryEmbedding: [0.1, 0.2, 0.3, ...],
limit: 10,
threshold: 0.8 // Only return results with distance < 0.8
});
