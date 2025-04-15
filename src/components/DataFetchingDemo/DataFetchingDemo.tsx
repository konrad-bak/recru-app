import { Button } from "@ui";
import React, { useState } from "react";
import { useDataFetching } from "../../hooks/useDataFetching";

// Example type for the fetched data
interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

const DataFetchingDemo: React.FC = () => {
  const [postId, setPostId] = useState<number>(1);
  const apiUrl = `https://jsonplaceholder.typicode.com/posts/${postId}`;
  const apiUrlFixed = `https://jsonplaceholder.typicode.com/posts/5`; // For deduplication demo

  // --- Instance 1: Fetching based on postId state ---
  const {
    data: postData,
    error: postError,
    isLoading: postIsLoading,
    isValidating: postIsValidating,
    refetch: refetchPost,
    mutate: mutatePost,
  } = useDataFetching<Post>(apiUrl, {
    onError: (err) => alert(`Post Fetch Error: ${err.message}`),
  });

  // --- Instance 2: Fetching a fixed URL (to demo deduplication/caching) ---
  const {
    data: fixedData,
    isLoading: fixedIsLoading,
    isValidating: fixedIsValidating,
    refetch: refetchFixed,
  } = useDataFetching<Post>(apiUrlFixed);

  const handleNextPost = () => {
    setPostId((prevId) => prevId + 1);
  };

  const handlePrevPost = () => {
    setPostId((prevId) => Math.max(1, prevId - 1));
  };

  const handleMutateTitle = () => {
    mutatePost((currentData) => {
      if (!currentData)
        return {
          id: postId,
          userId: 1,
          title: "Optimistic New Title",
          body: "",
        }; // Should ideally not happen if mutate is called correctly
      return {
        ...currentData,
        title: `(Mutated) ${currentData.title} - ${Date.now()}`,
      };
    }, true); // Pass true to revalidate after mutation
  };

  console.log(
    `[DataFetchingDemo] Rendering. PostID: ${postId}, Loading: ${postIsLoading}, Validating: ${postIsValidating}`
  );
  console.log(
    `[DataFetchingDemo] Fixed Post 5 - Loading: ${fixedIsLoading}, Validating: ${fixedIsValidating}`
  );

  return (
    <div style={{ color: "white" }}>
      <h2>useDataFetching Demo</h2>

      <section
        style={{
          border: "1px solid lightblue",
          padding: "10px",
          marginBottom: "15px",
        }}
      >
        <h3>Fetching Post ID: {postId}</h3>
        <Button onClick={handlePrevPost} disabled={postId <= 1}>
          Previous Post
        </Button>
        <Button onClick={handleNextPost}>Next Post</Button>
        <Button
          onClick={() => refetchPost()}
          disabled={postIsLoading || postIsValidating}
        >
          Refetch Post {postId}
        </Button>
        <Button
          onClick={handleMutateTitle}
          disabled={!postData || postIsLoading || postIsValidating}
        >
          Mutate Title (Optimistic)
        </Button>

        <div>
          <strong>Status:</strong>
          {postIsLoading && <span> Loading...</span>}
          {postIsValidating && <span> Validating...</span>}
          {!postIsLoading && !postIsValidating && postData && (
            <span> Idle (Data Loaded)</span>
          )}
          {postError && <span style={{ color: "red" }}> Error</span>}
        </div>

        {postError && (
          <pre style={{ color: "red" }}>Error: {postError.message}</pre>
        )}

        {postData && (
          <article>
            <h4>{postData.title}</h4>
            <p>{postData.body}</p>
          </article>
        )}
        {!postData && !postIsLoading && !postError && <span>No data yet.</span>}
      </section>

      <section style={{ border: "1px solid lightgreen", padding: "10px" }}>
        <h3>Fetching Fixed Post ID: 5 (for Cache/Dedupe Demo)</h3>
        <Button
          onClick={() => refetchFixed()}
          disabled={fixedIsLoading || fixedIsValidating}
        >
          Refetch Post 5
        </Button>
        <div>
          <strong>Status:</strong>
          {fixedIsLoading && <span> Loading...</span>}
          {fixedIsValidating && <span> Validating...</span>}
          {!fixedIsLoading && !fixedIsValidating && fixedData && (
            <span> Idle (Data Loaded)</span>
          )}
        </div>
        {fixedData && (
          <article>
            <h4>{fixedData.title}</h4>
          </article>
        )}
        {!fixedData && !fixedIsLoading && <span>No data yet.</span>}
        <p>
          <small>
            Observe console logs and network tab when switching posts or
            refetching Post 5 multiple times quickly.
          </small>
        </p>
      </section>
    </div>
  );
};

export default DataFetchingDemo;
